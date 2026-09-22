-- Central catalogue (plan.md Section 3.1.4). Reproducible: run this in the Supabase SQL
-- editor for the cloud project, or let the local `db` container load it from
-- /docker-entrypoint-initdb.d/ on first start. `if not exists` keeps it re-runnable.
create table if not exists products (
  sku        text          primary key,
  name       text          not null,
  price      numeric(10,2) not null,
  updated_at timestamptz   not null default now()
);

-- Per-store, per-SKU live price and sync health. `GET /prices` compares the row here
-- against products.price to decide has_mismatch. `on update cascade` is what lets the
-- dashboard rename a SKU: the sync log and the stored image follow the product.
create table if not exists store_sync_status (
  store          text          not null,
  sku            text          not null references products (sku) on update cascade on delete cascade,
  live_price     numeric(10,2),
  status         text          not null check (status in ('synced', 'mismatch', 'failed')),
  last_synced_at timestamptz,
  error          text,
  primary key (store, sku)
);

-- The product image itself, one per product, held as bytes rather than a URL: the sync hands
-- Shopify a *file* (staged uploads take an upload, not a link), and re-running the sync must not
-- have to search the image provider again. `sku` as the primary key is what makes the fetch
-- idempotent. Attribution travels with the bytes because the licences that permit commercial use
-- (`by`, `by-sa`) require it.
create table if not exists product_images (
  sku          text        primary key references products (sku) on update cascade on delete cascade,
  provider     text        not null,
  search_term  text        not null,
  source_url   text        not null,
  landing_url  text        not null,
  source_title text,
  license      text        not null,
  creator      text,
  content_type text        not null,
  bytes        bytea       not null,
  sha256       text        not null,
  fetched_at   timestamptz not null default now()
);

-- Added after the first fetch: the provider's own title for the file it served, so a chosen image
-- can be judged (and replaced) from the database alone rather than by repeating the search.
alter table product_images add column if not exists source_title text;

-- The same `on update cascade` for a database that was created before the dashboard could rename a
-- SKU, since `create table if not exists` above leaves existing tables untouched. Dropping first is
-- what keeps the pair re-runnable.
alter table store_sync_status drop constraint if exists store_sync_status_sku_fkey;
alter table store_sync_status add constraint store_sync_status_sku_fkey
  foreign key (sku) references products (sku) on update cascade on delete cascade;
alter table product_images drop constraint if exists product_images_sku_fkey;
alter table product_images add constraint product_images_sku_fkey
  foreign key (sku) references products (sku) on update cascade on delete cascade;

-- Append-only audit trail: one row per place a write landed (the central row, Store A, Store B), the
-- rows of one operation sharing a `change_id`. Deliberately no foreign key on `sku` and nothing that
-- cascades: a rename must not rewrite history, so the log records what the values were at the time.
-- `target` is left unconstrained because it is a store key from configuration, not a fixed vocabulary.
create table if not exists change_log (
  id        bigserial   primary key,
  change_id uuid        not null,
  at        timestamptz not null default now(),
  target    text        not null,
  sku       text        not null,
  field     text        not null check (field in ('price', 'name', 'sku', 'image')),
  old_value text,
  new_value text,
  status    text        not null check (status in ('applied', 'synced', 'mismatch', 'failed')),
  error     text
);

create index if not exists change_log_at_idx on change_log (at desc);
create index if not exists change_log_sku_at_idx on change_log (sku, at desc);
create index if not exists change_log_change_id_idx on change_log (change_id);
