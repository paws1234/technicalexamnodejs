import { pool } from './db.js';

export async function productExists(sku) {
  const { rows } = await pool.query('select exists (select 1 from products where sku = $1) as found', [sku]);
  return rows[0].found;
}

export async function getProduct(sku) {
  const { rows } = await pool.query('select sku, name, price from products where sku = $1', [sku]);
  return rows[0] ?? null;
}

// The dashboard's edit of the two text fields. A changed SKU is a natural-key update, and the two
// child tables follow it (`on update cascade`, seed/schema.sql), so one statement keeps the
// catalogue, the sync log and the stored image pointing at the same product.
export async function updateProductDetails(sku, { sku: nextSku, name }) {
  const { rows } = await pool.query(
    'update products set sku = $1, name = $2, updated_at = now() where sku = $3 returning sku, name, price',
    [nextSku, name, sku],
  );
  return rows[0];
}

export async function getImage(sku) {
  const { rows } = await pool.query(
    'select content_type, bytes, sha256 from product_images where sku = $1',
    [sku],
  );
  return rows[0] ?? null;
}

// A dashboard upload replaces the row outright: the bytes it holds are the ones the stores carry,
// so the provenance columns describe *these* bytes — a fetch from Openverse that is overwritten
// stops claiming a provider it no longer came from.
export async function replaceProductImage({ sku, bytes, contentType, sha256, filename }) {
  const { rows } = await pool.query(
    `insert into product_images
       (sku, provider, search_term, source_url, landing_url, source_title, license, creator,
        content_type, bytes, sha256, fetched_at)
     values ($1, 'upload', 'dashboard upload', $2, $2, $3, 'uploaded', null, $4, $5, $6, now())
     on conflict (sku) do update set
       provider = excluded.provider, search_term = excluded.search_term, source_url = excluded.source_url,
       landing_url = excluded.landing_url, source_title = excluded.source_title, license = excluded.license,
       creator = excluded.creator, content_type = excluded.content_type, bytes = excluded.bytes,
       sha256 = excluded.sha256, fetched_at = excluded.fetched_at
     returning sha256, length(bytes)::int as size`,
    [sku, `upload://${filename}`, filename, contentType, bytes, sha256],
  );
  return rows[0];
}

// `returning price` hands back what the database stored rather than what was sent, so the response
// and the sync log report the same numeric(10,2) string the row holds.
export async function updateCentralPrice(sku, price) {
  const { rows } = await pool.query(
    'update products set price = $1, updated_at = now() where sku = $2 returning price',
    [price, sku],
  );
  return rows[0].price;
}

// `on conflict` means a SKU is described by its latest attempt rather than by every attempt it
// ever had.
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

// Three flat queries rather than a SQL join: `products` is the list and the status rows are sparse,
// so grouping them is a Map lookup. numeric(10,2) comes back from pg as a string, which is what
// makes central_price and live_price compare exactly, with no float rounding in between. The image
// is reported as its hash rather than its bytes — the dashboard renders it from `/images/:sku` and
// uses the hash to make a replaced image a different URL.
export async function listPrices() {
  const [products, statuses, images] = await Promise.all([
    pool.query('select sku, name, price from products order by sku'),
    pool.query('select sku, store, live_price, status, last_synced_at, error from store_sync_status'),
    pool.query('select sku, sha256, length(bytes)::int as bytes from product_images'),
  ]);

  const bySku = new Map();
  for (const { sku, store, ...status } of statuses.rows) {
    bySku.set(sku, { ...(bySku.get(sku) ?? {}), [store]: status });
  }

  const imageBySku = new Map(images.rows.map(({ sku, ...image }) => [sku, image]));

  return products.rows.map(({ sku, name, price }) => ({
    sku,
    name,
    central_price: price,
    image: imageBySku.get(sku) ?? null,
    stores: bySku.get(sku) ?? {},
  }));
}
