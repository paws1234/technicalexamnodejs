#!/usr/bin/env node
// Fills store_sync_status from what the stores actually hold. `GET /prices` reads the stores itself,
// so this is no longer what the dashboard compares against: it keeps the recorded log level with the
// stores, and it is the independent read used to check the app. It sends no price anywhere.
//
//   node backend/scripts/refresh-status.js
import { pool } from '../src/db.js';
import { listPrices, recordSyncResult } from '../src/queries.js';
import { findVariantBySku } from '../src/shopify.js';
import { stores } from '../src/stores.js';

const rows = await listPrices();
let failures = 0;

for (const { sku, central_price: central } of rows) {
  for (const store of stores) {
    try {
      const { price } = await findVariantBySku(sku, store);
      // pg hands numeric(10,2) back as a string and Shopify's Money is a string too, so compare
      // as numbers: "22.0" and "22.00" are the same price, not a mismatch.
      const status = Number(price) === Number(central) ? 'synced' : 'mismatch';
      await recordSyncResult({ store: store.key, sku, status, livePrice: price });
    } catch (error) {
      failures++;
      console.error(`${sku} ${store.key}: ${error.message}`);
      await recordSyncResult({ store: store.key, sku, status: 'failed', error: error.message });
    }
  }
}

const {
  rows: [{ n }],
} = await pool.query('select count(*)::int as n from store_sync_status');
console.log(`${n} rows in store_sync_status for ${rows.length} SKUs × ${stores.length} stores, ${failures} failed`);

await pool.end();
process.exit(failures > 0 ? 1 : 0);
