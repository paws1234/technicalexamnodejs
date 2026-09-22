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

// Leading digit required, so `-1`, `1e3` and an empty body all fail one test; `\.\d{1,2}` rejects
// the third decimal.
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

// A SKU is used as a GraphQL query term, a Shopify inventory key and a URL path, so it is kept to
// characters no layer has to escape.
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_NAME_LENGTH = 255; // Shopify's own title limit

// A fetch failure's useful part (ENOTFOUND, ECONNREFUSED, EAI_AGAIN) is on `cause`, not on `message`.
const reason = (error) => (error.cause ? `${error.message}: ${error.cause.code ?? error.cause.message}` : error.message);

// Never listens: server.js owns the port locally, and Vercel wraps this same object.
export const app = express();

app.use(cors({ origin: config.allowedOrigin }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Two Admin API reads per request, not twenty: the rows carry what the stores hold *now*, so a price
// changed straight in a Shopify admin is flagged on the next page load instead of hiding behind the
// last recorded value. A store that cannot be read is reported as `failed` on every row — the
// catalogue itself is still available, so that stays a 200.
//
// A rejected query reaches the error handler below by itself (Express 5).
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

// One store's half of the sync. Its failure is recorded and returned here, never thrown, so the
// other store's branch still runs to completion.
async function syncStore(sku, store, price) {
  let storePrice; // the store's price, once the lookup has told us
  try {
    const variant = await findVariantBySku(sku, store);
    storePrice = variant.price;
    const livePrice = await updateVariantPrice(store, variant, price);
    await recordSyncResult({ store: store.key, sku, status: 'synced', livePrice });
    return { store: store.key, status: 'synced', error: null };
  } catch (error) {
    // `failed` when even the lookup failed, so the store's price is unknown; `mismatch` when the
    // write failed after the lookup revealed the store holds something else.
    const status = storePrice === undefined ? 'failed' : 'mismatch';
    const message = reason(error);
    await recordSyncResult({ store: store.key, sku, status, livePrice: storePrice ?? null, error: message });
    return { store: store.key, status, error: message };
  }
}

// ponytail: no authentication on this route (assumption 6 records it as a known risk). Upgrade: a
// token check in front of it.
app.patch('/prices/:sku', async (req, res) => {
  const { sku } = req.params;
  const price = req.body?.price;
  // A JSON number or the string form of one — "19.99" is how prices are spelled everywhere else
  // here, and pg hands numeric(10,2) back as a string too.
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

  // A store that failed is worth reporting, not worth failing the request: the central price is
  // saved either way, so only "no store took it" is an error.
  const noStoreSynced = results.every((result) => result.status !== 'synced');
  return res.status(noStoreSynced ? 502 : 200).json({ sku, price: applied, stores: results });
});

// The stored image bytes, which is what the dashboard's <img> fetches.
//
// The URL is content-addressed (`?v=<sha256>`), so the bytes behind a given URL can never change:
// the cache is told it may keep them for a year and never revalidate. That is what stops ten
// thumbnails per page view — eleven connections with the page's own query — from being eleven
// database connections every time, because the edge answers a cached image without invoking this
// function at all. A replaced image is uploaded under a *new* hash and therefore a new URL, so
// nothing here can go stale. The ETag is kept for a client that revalidates anyway.
app.get('/images/:sku', async (req, res) => {
  const image = await getImage(req.params.sku);
  if (!image) {
    return res.status(404).json({ error: `no image for sku: ${req.params.sku}` });
  }
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('ETag', `"${image.sha256}"`);
  res.type(image.content_type).send(image.bytes);
});

// One store's half of an image replacement. The media the product already holds is deleted first:
// a product reports two images otherwise and the store shows whichever it prefers, and deleting is
// also what makes the retry path the same request rather than a clean-up.
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

// The uploaded file *is* the request body (`express.raw`), because a browser hands over a File and
// there is no reason to wrap it in a multipart form or a base64 string that only has to be undone
// here. Any Content-Type is accepted, because the declared type is only as good as the file's
// extension — a browser reports `''` for a name it does not recognise — while `sniffImageType`
// reads the magic bytes, which is the claim Shopify will actually test.
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

  // Read before the write, because the alt text the store gets is the product's current name.
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

  // Same shape as the price route: the image is stored either way, so only "neither store took it"
  // is an error worth a 502.
  const noStoreSynced = results.every((result) => result.status !== 'synced');
  return res.status(noStoreSynced ? 502 : 200).json({ sku, sha256, bytes: bytes.length, stores: results });
});

// One store's half of a product edit. The SKU moves before the title, because the SKU is what every
// later lookup searches on: a store that fails here is the one whose next price sync will report
// "no variant found", and the response says which store that is.
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

// The two fields the dashboard edits that are not the price. A renamed SKU is the interesting case:
// it is the catalogue's primary key *and* the key the stores are searched by, so the central row is
// renamed first (both child tables follow it) and then each store's variant is moved to match.
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
  // 409 rather than letting the primary key raise: a name nobody can place is worse than a
  // conflict the dashboard can show. A retry of a rename the stores did not take sends the SKU it
  // already has, which is why the same value is not a conflict.
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

// Four arguments is what marks this as Express's error handler; without it a malformed JSON body
// answers with Express's HTML stack trace instead of JSON.
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  // A 5xx is a bug or an outage rather than a bad request, so it goes to the log — the caller only
  // gets a generic message, and this is the one place the real reason is written down.
  if (status >= 500) console.error(`${req.method} ${req.originalUrl}:`, err);
  // A client error keeps its message so the caller can fix the request; a server error does not,
  // so a database or Shopify failure cannot leak its internals.
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});

// Vercel's Express entry has to default-export the app or listen. `src/app.js` is checked before
// `src/server.js` and does neither, so without this line every deployed request answers 500
// "Invalid export found … The default export must be a function or server".
export default app;
