import { pool } from './db.js';

export async function productExists(sku) {
  const { rows } = await pool.query('select exists (select 1 from products where sku = $1) as found', [sku]);
  return rows[0].found;
}

export async function getProduct(sku) {
  const { rows } = await pool.query('select sku, name, price from products where sku = $1', [sku]);
  return rows[0] ?? null;
}

// The update and its log rows are one statement, so the log cannot drift from the change (the pooler runs in transaction mode, so a session cannot span statements).
export async function updateProductDetails(sku, { sku: nextSku, name }, changeId) {
  const { rows } = await pool.query(
    `with before as (
       select sku as old_sku, name as old_name from products where sku = $3
     ), updated as (
       update products set sku = $1, name = $2, updated_at = now() where sku = $3
       returning sku, name, price
     ), logged as (
       insert into change_log (change_id, target, sku, field, old_value, new_value, status)
       select $4::uuid, 'central', before.old_sku, 'sku', before.old_sku, updated.sku, 'applied'
       from before, updated where before.old_sku is distinct from updated.sku
       union all
       select $4::uuid, 'central', before.old_sku, 'name', before.old_name, updated.name, 'applied'
       from before, updated where before.old_name is distinct from updated.name
     )
     select sku, name, price from updated`,
    [nextSku, name, sku, changeId],
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

export async function replaceProductImage({ sku, bytes, contentType, sha256, filename }, changeId) {
  const { rows } = await pool.query(
    `with before as (select sha256 as old_sha from product_images where sku = $1),
     saved as (
       insert into product_images
         (sku, provider, search_term, source_url, landing_url, source_title, license, creator,
          content_type, bytes, sha256, fetched_at)
       values ($1, 'upload', 'dashboard upload', $2, $2, $3, 'uploaded', null, $4, $5, $6, now())
       on conflict (sku) do update set
         provider = excluded.provider, search_term = excluded.search_term, source_url = excluded.source_url,
         landing_url = excluded.landing_url, source_title = excluded.source_title, license = excluded.license,
         creator = excluded.creator, content_type = excluded.content_type, bytes = excluded.bytes,
         sha256 = excluded.sha256, fetched_at = excluded.fetched_at
       returning sha256, length(bytes)::int as size
     ), logged as (
       insert into change_log (change_id, target, sku, field, old_value, new_value, status)
       select $7::uuid, 'central', $1, 'image', coalesce(before.old_sha, 'none'), saved.sha256, 'applied'
       from saved left join before on true
     )
     select sha256, size from saved`,
    [sku, `upload://${filename}`, filename, contentType, bytes, sha256, changeId],
  );
  return rows[0];
}

export async function updateCentralPrice(sku, price, changeId) {
  const { rows } = await pool.query(
    `with before as (select price as old_price from products where sku = $2),
     updated as (update products set price = $1, updated_at = now() where sku = $2 returning price),
     logged as (
       insert into change_log (change_id, target, sku, field, old_value, new_value, status)
       select $3::uuid, 'central', $2, 'price', before.old_price, updated.price, 'applied'
       from before, updated
     )
     select price from updated`,
    [price, sku, changeId],
  );
  return rows[0].price;
}

export async function recordChange({
  changeId,
  target,
  sku,
  field,
  oldValue = null,
  newValue = null,
  status,
  error = null,
}) {
  await pool.query(
    `insert into change_log (change_id, target, sku, field, old_value, new_value, status, error)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [changeId, target, sku, field, oldValue, newValue, status, error],
  );
}

export async function listChanges({ limit = 50, sku = null } = {}) {
  const { rows } = await pool.query(
    `select id, change_id, at, target, sku, field, old_value, new_value, status, error
     from change_log
     where $1::text is null or sku = $1
     order by id desc
     limit $2`,
    [sku, limit],
  );
  return rows;
}

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
