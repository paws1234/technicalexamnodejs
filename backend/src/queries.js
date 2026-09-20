// The read layer behind GET /prices and the refresh script.
import { pool } from './db.js';

export async function productExists(sku) {
  const { rows } = await pool.query('select exists (select 1 from products where sku = $1) as found', [sku]);
  return rows[0].found;
}

// §3.2.4 Step A — the central price is the source of truth, so it is recorded before either
// store is told about it. `returning price` hands back what the database actually stored (a
// numeric(10,2) string), which is what the response and the sync log both report.
export async function updateCentralPrice(sku, price) {
  const { rows } = await pool.query(
    'update products set price = $1, updated_at = now() where sku = $2 returning price',
    [price, sku],
  );
  return rows[0].price;
}

// §3.2.4 Step C — the per-store, per-SKU sync log, written on every attempt: `on conflict` means
// a SKU is described by its latest attempt rather than by every attempt it ever had.
export async function recordSyncResult({ store, sku, status, livePrice = null, error = null }) {
  await pool.query(
    `insert into store_sync_status (store, sku, live_price, status, last_synced_at, error)
     values ($1, $2, $3, $4, now(), $5)
     on conflict (store, sku) do update set
       live_price = excluded.live_price,
       status = excluded.status,
       last_synced_at = excluded.last_synced_at,
       error = excluded.error`,
    [store, sku, livePrice, status, error],
  );
}

// The catalogue plus whatever each store last reported for it. Two flat queries rather than a
// SQL join: `products` is the list, the status rows are sparse (a SKU the sync has never
// touched has none), and grouping them is a Map lookup. numeric(10,2) columns come back from pg
// as strings, which is what we want here — central_price and live_price then compare exactly,
// with no float rounding in between.
export async function listPrices() {
  const [products, statuses] = await Promise.all([
    pool.query('select sku, name, price from products order by sku'),
    pool.query('select sku, store, live_price, status, last_synced_at, error from store_sync_status'),
  ]);

  const bySku = new Map();
  for (const { sku, store, ...status } of statuses.rows) {
    bySku.set(sku, { ...(bySku.get(sku) ?? {}), [store]: status });
  }

  return products.rows.map(({ sku, name, price }) => ({
    sku,
    name,
    central_price: price,
    stores: bySku.get(sku) ?? {},
  }));
}
