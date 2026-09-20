import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { flagMismatches } from './prices.js';
import { listPrices, productExists, recordSyncResult, updateCentralPrice } from './queries.js';
import { findVariantBySku, updateVariantPrice } from './shopify.js';
import { stores } from './stores.js';

// What the route accepts as a price: a plain decimal with at most two decimal places. The
// leading-digit requirement is what rejects `-1`, `1e3` and an empty body in one test, and
// `\.\d{1,2}` is what rejects the third decimal.
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

// No side effects on import: this module exports the app object and never listens, so
// server.js (T-1.8) owns the port and T-3.2 can hand the same object to Vercel.
export const app = express();

// The dashboard is the only browser client, so its origin is the only one allowed.
app.use(cors({ origin: config.allowedOrigin }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// §3.2.3 — the central prices with each store's last known state, each row flagged when a
// store has drifted. A rejected query reaches the error handler below by itself (Express 5).
app.get('/prices', async (req, res) => {
  res.json(flagMismatches(await listPrices()));
});

// §3.2.4 Step B — one store's half of the sync: locate the variant by SKU, write the price, and
// record what happened. Step C lives in the catch: this store's failure is written down here and
// never reaches the caller as a throw, so the other store's branch still runs to completion.
async function syncStore(sku, store, price) {
  let storePrice; // the price the store was holding, once the lookup has told us
  try {
    const variant = await findVariantBySku(sku, store);
    storePrice = variant.price;
    const livePrice = await updateVariantPrice(store, variant, price);
    await recordSyncResult({ store: store.key, sku, status: 'synced', livePrice });
    return { store: store.key, status: 'synced', error: null };
  } catch (error) {
    // `failed` when even the lookup failed, so the store's price is unknown; `mismatch` when the
    // write failed after we learned the store is holding something else.
    const status = storePrice === undefined ? 'failed' : 'mismatch';
    const message = error.cause ? `${error.message}: ${error.cause.code ?? error.cause.message}` : error.message;
    await recordSyncResult({ store: store.key, sku, status, livePrice: storePrice ?? null, error: message });
    return { store: store.key, status, error: message };
  }
}

// §3.2.4 — the price reaches two live stores and the central table, so it is checked here,
// before anything is written anywhere. No authentication (assumption 6 records that as a known
// risk rather than an oversight).
app.patch('/prices/:sku', async (req, res) => {
  const { sku } = req.params;
  const price = req.body?.price;
  // A JSON number, or the string form of one — "19.99" is how prices are spelled everywhere
  // else in this project, and pg hands numeric(10,2) back as a string too.
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

  // §3.2.4 Step C — a store that failed is worth reporting, not worth failing the request: the
  // central price is saved either way, and only when no store took it is there nothing to
  // report but an error. The dashboard reads `stores` to say which one let the price slip.
  const noStoreSynced = results.every((result) => result.status !== 'synced');
  return res.status(noStoreSynced ? 502 : 200).json({ sku, price: applied, stores: results });
});

// Four arguments is what marks this as Express's error handler. Without it a malformed
// JSON body answers with Express's HTML stack trace instead of JSON.
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  // Client errors (a malformed body) keep their message so the caller can fix the
  // request; a server error does not, so a database or Shopify failure cannot leak its
  // internals to whoever is calling.
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});
