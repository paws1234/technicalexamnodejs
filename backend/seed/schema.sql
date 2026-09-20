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
-- against products.price to decide has_mismatch.
create table if not exists store_sync_status (
  store          text          not null,
  sku            text          not null references products (sku) on delete cascade,
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
  sku          text        primary key references products (sku) on delete cascade,
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
