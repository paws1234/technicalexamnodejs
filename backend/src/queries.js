import { pool } from './db.js';

export async function productExists(sku) {
  const { rows } = await pool.query('select exists (select 1 from products where sku = $1) as found', [sku]);
  return rows[0].found;
}

export async function getProduct(sku) {
  const { rows } = await pool.query('select sku, name, price from products where sku = $1', [sku]);
  return rows[0] ?? null;
}

// A changed SKU is a natural-key update; both child tables carry `on update cascade`, so one statement follows it.
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

// Replaced outright: the provenance columns must describe the bytes the stores now carry, not the fetched ones.
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

// `returning price` reports what the row stores (a numeric(10,2) string), not what was sent.
export async function updateCentralPrice(sku, price) {
  const { rows } = await pool.query(
    'update products set price = $1, updated_at = now() where sku = $2 returning price',
    [price, sku],
  );
  return rows[0].price;
}

// `on conflict`: a SKU keeps its latest attempt, not every attempt it ever had.
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

// Three flat queries grouped in JS (the status rows are sparse); the image ships as its hash, which the dashboard turns into `/images/:sku?v=`.
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
