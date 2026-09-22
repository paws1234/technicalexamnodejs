import cors from 'cors';
import express from 'express';
import { createHash } from 'node:crypto';
import { config } from './config.js';
import { imageFilename, sniffImageType } from './images.js';
import { flagMismatches, mergeLivePrices } from './prices.js';
import {
  getImage,
  getProduct,
  listPrices,
  productExists,
  recordSyncResult,
  replaceProductImage,
  updateCentralPrice,
  updateProductDetails,
} from './queries.js';
import {
  addProductImage,
  deleteMediaFiles,
  findVariantBySku,
  productMedia,
  readStorePrices,
  updateProductTitle,
  updateVariantPrice,
  updateVariantSku,
} from './shopify.js';
import { stores } from './stores.js';

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_NAME_LENGTH = 255; // Shopify's own title limit

const reason = (error) => (error.cause ? `${error.message}: ${error.cause.code ?? error.cause.message}` : error.message);

export const app = express();

app.use(cors({ origin: config.allowedOrigin }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/prices', async (req, res) => {
  const rows = await listPrices();
  const live = await Promise.all(
    stores.map(async (store) => {
      try {
        return { key: store.key, prices: await readStorePrices(store) };
      } catch (error) {
        return { key: store.key, error: reason(error) };
      }
    }),
  );
  res.json(flagMismatches(mergeLivePrices(rows, live)));
});

async function syncStore(sku, store, price) {
  let storePrice; // the store's price, once the lookup has told us
  try {
    const variant = await findVariantBySku(sku, store);
    storePrice = variant.price;
    const livePrice = await updateVariantPrice(store, variant, price);
    await recordSyncResult({ store: store.key, sku, status: 'synced', livePrice });
    return { store: store.key, status: 'synced', error: null };
  } catch (error) {
    const status = storePrice === undefined ? 'failed' : 'mismatch';
    const message = reason(error);
    await recordSyncResult({ store: store.key, sku, status, livePrice: storePrice ?? null, error: message });
    return { store: store.key, status, error: message };
  }
}

// ponytail: no authentication (a recorded risk). Upgrade: a token check in front of this route.
app.patch('/prices/:sku', async (req, res) => {
  const { sku } = req.params;
  const price = req.body?.price;
  const text = typeof price === 'number' ? String(price) : price;
  if (typeof text !== 'string' || !PRICE_PATTERN.test(text)) {
    return res.status(400).json({ error: 'price must be a non-negative number with at most 2 decimals' });
  }

  if (!(await productExists(sku))) {
    return res.status(404).json({ error: `unknown sku: ${sku}` });
  }

  const applied = await updateCentralPrice(sku, text);

  const results = [];
  for (const store of stores) {
    results.push(await syncStore(sku, store, applied));
  }

  const noStoreSynced = results.every((result) => result.status !== 'synced');
  return res.status(noStoreSynced ? 502 : 200).json({ sku, price: applied, stores: results });
});

app.get('/images/:sku', async (req, res) => {
  const image = await getImage(req.params.sku);
  if (!image) {
    return res.status(404).json({ error: `no image for sku: ${req.params.sku}` });
  }
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('ETag', `"${image.sha256}"`);
  res.type(image.content_type).send(image.bytes);
});

async function syncImage(sku, store, { filename, bytes, contentType, alt }) {
  try {
    const { productId } = await findVariantBySku(sku, store);
    const held = (await productMedia(store, productId)).filter((node) => node.mediaContentType === 'IMAGE');
    if (held.length > 0) await deleteMediaFiles(store, held.map((node) => node.id));
    const node = await addProductImage(store, productId, { filename, bytes, contentType, alt });
    return { store: store.key, status: 'synced', error: null, media: node.image?.url ?? null };
  } catch (error) {
    return { store: store.key, status: 'failed', error: reason(error) };
  }
}

// The file *is* the request body (`express.raw`); any Content-Type is accepted — `sniffImageType` reads the magic bytes instead.
app.put('/images/:sku', express.raw({ type: () => true, limit: '8mb' }), async (req, res) => {
  const { sku } = req.params;
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'send the image as the request body' });
  }
  const bytes = req.body;
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return res.status(400).json({ error: 'body is not a JPEG, PNG, WebP or GIF image' });
  }

  const product = await getProduct(sku);
  if (!product) {
    return res.status(404).json({ error: `unknown sku: ${sku}` });
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const filename = imageFilename(product.name, contentType);
  await replaceProductImage({ sku, bytes, contentType, sha256, filename });

  const results = [];
  for (const store of stores) {
    results.push(await syncImage(sku, store, { filename, bytes, contentType, alt: product.name }));
  }

  const noStoreSynced = results.every((result) => result.status !== 'synced');
  return res.status(noStoreSynced ? 502 : 200).json({ sku, sha256, bytes: bytes.length, stores: results });
});

async function syncDetails(store, { from, to, name }) {
  try {
    const { variantId, productId } = await findVariantBySku(from, store);
    if (to !== from) await updateVariantSku(store, { variantId, productId }, to);
    await updateProductTitle(store, productId, name);
    return { store: store.key, status: 'synced', error: null };
  } catch (error) {
    return { store: store.key, status: 'failed', error: reason(error) };
  }
}

app.patch('/products/:sku', async (req, res) => {
  const { sku } = req.params;
  const body = req.body ?? {};
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const nextSku = typeof body.sku === 'string' ? body.sku.trim() : undefined;

  if (nextSku === undefined && name === undefined) {
    return res.status(400).json({ error: 'send a new name and/or sku' });
  }
  if (name !== undefined && (name.length === 0 || name.length > MAX_NAME_LENGTH)) {
    return res.status(400).json({ error: `name must be 1-${MAX_NAME_LENGTH} characters` });
  }
  if (nextSku !== undefined && !SKU_PATTERN.test(nextSku)) {
    return res.status(400).json({ error: 'sku must be 1-64 characters of letters, digits, dot, dash or underscore' });
  }

  const current = await getProduct(sku);
  if (!current) {
    return res.status(404).json({ error: `unknown sku: ${sku}` });
  }
  const targetSku = nextSku ?? sku;
  if (targetSku !== sku && (await productExists(targetSku))) {
    return res.status(409).json({ error: `sku already in use: ${targetSku}` });
  }

  const applied = await updateProductDetails(sku, { sku: targetSku, name: name ?? current.name });

  const results = [];
  for (const store of stores) {
    results.push(await syncDetails(store, { from: sku, to: applied.sku, name: applied.name }));
  }

  const noStoreSynced = results.every((result) => result.status !== 'synced');
  return res.status(noStoreSynced ? 502 : 200).json({
    sku: applied.sku,
    previous_sku: sku,
    name: applied.name,
    stores: results,
  });
});

app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(`${req.method} ${req.originalUrl}:`, err);
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});

export default app;
