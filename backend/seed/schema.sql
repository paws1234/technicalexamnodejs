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
