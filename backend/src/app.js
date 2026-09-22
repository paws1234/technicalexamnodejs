import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { flagMismatches } from './prices.js';
import { listPrices, productExists, recordSyncResult, updateCentralPrice } from './queries.js';
import { findVariantBySku, updateVariantPrice } from './shopify.js';
import { stores } from './stores.js';

// Leading digit required, so `-1`, `1e3` and an empty body all fail one test; `\.\d{1,2}` rejects
// the third decimal.
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

// Never listens: server.js owns the port locally, and Vercel wraps this same object.
export const app = express();

app.use(cors({ origin: config.allowedOrigin }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// A rejected query reaches the error handler below by itself (Express 5).
app.get('/prices', async (req, res) => {
  res.json(flagMismatches(await listPrices()));
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
    const message = error.cause ? `${error.message}: ${error.cause.code ?? error.cause.message}` : error.message;
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

// Four arguments is what marks this as Express's error handler; without it a malformed JSON body
// answers with Express's HTML stack trace instead of JSON.
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  // A client error keeps its message so the caller can fix the request; a server error does not,
  // so a database or Shopify failure cannot leak its internals.
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});

// Vercel's Express entry has to default-export the app or listen. `src/app.js` is checked before
// `src/server.js` and does neither, so without this line every deployed request answers 500
// "Invalid export found … The default export must be a function or server".
export default app;
