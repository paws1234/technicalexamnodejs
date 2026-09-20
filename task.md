# Task Breakdown — Centralized Price Sync (Task 3)

> Source: `plan.md` · Generated: 2026-09-20 · Status: in progress

## How to use this file

Work top to bottom. The checkbox on the task heading is the single source of truth for progress —
update it, the task's `Evidence` line, and the Progress table in the same edit. If a task turns out
to be wrong or too big, split or rewrite it here first, then continue — this file is the source of
scope. `plan.md` stays unchanged.

| Mark | Meaning |
|---|---|
| `[ ]` | todo — not started |
| `[~]` | in progress — started, `Verify` not yet passing |
| `[x]` | done — its `Verify` step was run and passed |
| `[!]` | was marked done, re-verification failed |

**Size:** `S` ≤ 15 min · `M` 15–30 min. There are no `L` tasks — anything bigger was split.

**Evidence:** a task is done when its `Verify` command/observation succeeds, not when the code
exists. Record the actual command and observed result on the task's `Evidence` line.

## Progress

Keep this in sync whenever a checkbox changes. Count a task as done only when it is `[x]`; the
header `Status:` moves `not started` → `in progress` → `complete`.

| Phase | Tasks | Done / Total | Status |
|---|---|---|---|
| 0 — Environment & Store Preparation | 14 | 3 / 14 | in progress |
| 1 — Central Backend Service Development | 18 | 0 / 18 | not started |
| 2 — Frontend Dashboard Development | 8 | 0 / 8 | not started |
| 3 — Deployment | 7 | 0 / 7 | not started |
| 4 — End-to-end acceptance | 6 | 0 / 6 | not started |

**Overall:** 3 / 53 done

## Environment variables

| Name | Used by | Where it comes from | Set in |
|---|---|---|---|
| `SUPABASE_URL` | backend | Supabase → Project Settings → API | local `backend/.env`, Vercel (backend) |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | Supabase → Project Settings → API (secret) | local `backend/.env`, Vercel (backend) |
| `SHOPIFY_ALPHA_STORE` | backend | T-0.2 store handle, `<handle>.myshopify.com` | local `backend/.env`, Vercel (backend) |
| `SHOPIFY_BETA_STORE` | backend | T-0.2 store handle | local `backend/.env`, Vercel (backend) |
| `SHOPIFY_CLIENT_ID` | backend | T-0.6 Dev Dashboard app client id — one app, both stores | local `backend/.env`, Vercel (backend) |
| `SHOPIFY_CLIENT_SECRET` | backend | T-0.6 Dev Dashboard app client secret (secret) | local `backend/.env`, Vercel (backend) |
| `SHOPIFY_API_VERSION` | backend | pinned Admin API version string | local `backend/.env`, Vercel (backend) |
| `ALLOWED_ORIGIN` | backend | deployed frontend URL from T-3.5 | local `backend/.env`, Vercel (backend) |
| `PORT` | backend | local only | `backend/.env` |
| `NEXT_PUBLIC_API_URL` | frontend | T-3.3 deployed backend URL | local `frontend/.env.local`, Vercel (frontend) |

`SUPABASE_SERVICE_ROLE_KEY` and `SHOPIFY_CLIENT_SECRET` are server-only — they must never appear
in a `NEXT_PUBLIC_*` variable or in client-side code. The Admin API token itself is never stored:
it is minted per store at runtime and cached until it expires (T-1.5).

## Open questions / assumptions

1. **Shopify API surface is not fixed by the plan** (§3.1.3, §3.2.4 say "Custom App or Admin API access tokens"). Assumption: a **Dev Dashboard app** installed on both stores, exchanging `SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET` for a 24h Admin API token per store via the **client credentials grant**, sent as `X-Shopify-Access-Token`; GraphQL Admin API for variant lookup; API version pinned in one place (`SHOPIFY_API_VERSION`, tasks T-0.8/T-1.5). **Revised 2026-09-20:** the plan's other option — an admin-created custom app with a pasted access token — can no longer be created (Shopify's docs: "For new apps, use Dev Dashboard or Shopify CLI"), so the static `SHOPIFY_ALPHA_TOKEN`/`SHOPIFY_BETA_TOKEN` pair this file originally specified was replaced by the two app credentials.
2. **What `GET /prices` compares against.** §3.2.3 says to "aggregate central database records with store sync logs", so the compared value is `store_sync_status.live_price` (last known), not a live per-request Shopify read. Consequence: drift introduced directly in a Shopify admin is only visible after T-1.17 runs. Confirm whether a live read per request is expected instead.
3. **Nothing in the plan populates `store_sync_status` before the first `PATCH`.** Assumption: a refresh script reads live store prices and upserts the baseline (T-1.17), otherwise `GET /prices` has nothing to flag.
4. **`mismatch` vs `failed`.** §3.1.4 names only `synced` / `mismatch`; §3.2.4 also says `mismatch`/`failed`. Assumption: both values exist — `failed` = Shopify call errored, `mismatch` = store price differs from central. Confirm if only two states are wanted.
5. **The 10 SKUs are unspecified** (no identifiers, names, or prices). Assumption: defined in `backend/seed/products.json` (T-0.3) and seeded identically into both stores, using `SKU-001`…`SKU-010` in all verification steps.
6. **No authentication is specified for `PATCH /prices/:sku`.** Assumption: none is added (per `rules.md`, no unrequested features). Flagged as a risk: the route is publicly writable once deployed.
7. **Repo layout is unspecified.** §3.4.1/§3.4.2 allow "separate project or integrated frontend". Assumption: one repo, `backend/` and `frontend/` as sibling Vercel projects.
8. **Currency.** Assumption: single currency; all prices are 2-decimal `numeric(10,2)` and each store's defaults accept them.
9. **Express on Vercel has no default entry point.** Assumption: a thin serverless adapter is added in T-3.2 rather than switching frameworks.

---

## Phase 0 — Environment & Store Preparation

### [x] T-0.1 — Initialise the repo and root `.gitignore`

- **Depends on:** none
- **Size:** `S`
- **Why:** everything else is committed from here; secrets must never be committable (see Env vars table).
- **Do:**
  1. `git init` in the workspace root.
  2. Create root `.gitignore` covering `node_modules/`, `.env`, `.env.local`, `.next/`, `.vercel/`.
- **Files / artifacts:** `.gitignore`, `.git/`
- **Done when:** the repo exists and all secret/build paths are ignored.
- **Verify:** `git check-ignore -v backend/node_modules .env frontend/.next` → prints the matching `.gitignore` line for each of the three paths, exit 0.
- **Evidence:** 2026-09-20 — `git init` created `.git/` (branch `master`, empty repo). `git check-ignore -v backend/node_modules .env frontend/.next` printed `.gitignore:1:node_modules`, `.gitignore:2:.env`, `.gitignore:4:.next` and exited 0. Patterns are written without a trailing slash: a directory-only pattern (`node_modules/`) does not match a path that does not exist yet, which the `Verify` command queries.
- **Blocks:** `T-0.2`, `T-3.1`

### [x] T-0.2 — Create the two Shopify development stores

- **Depends on:** `T-0.1`
- **Size:** `S`
- **Why:** §3.1.1 — the two sync targets; Alpha exists, Beta does not.
- **Do:**
  1. In the **Dev Dashboard** (dev.shopify.com/dashboard) → **Dev stores**, create the two free development stores (Store Alpha, Store Beta) — or confirm Alpha is already listed and create Beta.
  2. Note both `<handle>.myshopify.com` domains.
- **Files / artifacts:** none — console step
- **Done when:** both stores appear under Dev Dashboard → Dev stores and each admin loads.
- **Verify:** Dev Dashboard → Dev stores lists both; `https://<alpha-handle>.myshopify.com/admin` and `https://<beta-handle>.myshopify.com/admin` each load (named UI observation).
- **Evidence:** 2026-09-20 — **verified**. `docker compose run --rm shopify store list` lists organisation `paws` (236557782) with three Dev/Advanced stores, all created 2026-09-20: `alphastore-sdgba8qx` (AlphaStore — the Alpha store), `betastore-haewq5ha` ("betastore" — the Beta store every later task uses) and a spare `betastore-himh5la5` ("BetaStore") that no task references; the spare is a leftover, delete it deliberately if it starts to confuse a check (destructive). Admin reachability needed a discriminating probe rather than a bare status code: every `<handle>.myshopify.com/admin`, real or not, answers `302` to its own login page, so the check is `curl -sL -o /dev/null -w '%{http_code} %{url_effective}'` — `alphastore-sdgba8qx` and `betastore-haewq5ha` both end on `403 https://admin.shopify.com/store/<handle>` (store exists, session required), while the control `price-sync-does-not-exist-9f3a` ends `404` still on its own login URL. Both admins load. The Dev Dashboard's Dev stores list shows the same organisation the CLI printed; the dashboard itself has no browser session in this agent, so the CLI listing plus the probe are the nearest live proof. Originally recorded 2026-09-20 as partly done with Beta missing; the Dev Dashboard route (not the Shopify admin) is what keeps `shop_not_permitted` from surfacing at T-0.6.
- **Blocks:** `T-0.4`, `T-0.5`, `T-0.6`, `T-0.7`

### [ ] T-0.3 — Define the 10 shared SKUs in a checked-in seed file

- **Depends on:** `T-0.1`
- **Size:** `S`
- **Why:** §1/§3.1.2 — the shared catalogue is the premise of the whole task; it must be identical in both stores.
- **Do:**
  1. Create `backend/seed/products.json` with exactly 10 objects: `{ "sku": "SKU-001", "name": "...", "price": 19.99 }` … `SKU-010`.
- **Files / artifacts:** `backend/seed/products.json`
- **Done when:** the file parses, has 10 unique SKUs, and each entry has a name and a 2-decimal price.
- **Verify:** `node -e "const p=require('./backend/seed/products.json'); const s=new Set(p.map(x=>x.sku)); if(p.length!==10||s.size!==10) throw new Error('expect 10 unique'); console.log(p.map(x=>x.sku).join(','))"` → prints `SKU-001,…,SKU-010`.
- **Evidence:** `-`
- **Blocks:** `T-0.4`, `T-0.5`, `T-0.13`, `T-1.17`

### [ ] T-0.4 — Seed the 10 products into Store Alpha

- **Depends on:** `T-0.2`, `T-0.3`
- **Size:** `M`
- **Why:** §3.1.2 — Alpha must hold the same SKUs so the sync has a target.
- **Do:**
  1. In the Alpha admin, create the 10 products with a single variant each, setting the variant SKU and price from `backend/seed/products.json` (manual entry or CSV bulk import).
- **Files / artifacts:** none — console step (optional import CSV under `backend/seed/`)
- **Done when:** Alpha products list shows 10 products whose variant SKUs match the seed file exactly.
- **Verify:** Alpha admin → Products shows 10 items; the exported/hand-checked SKU column matches the seed file 1:1 (named UI observation).
- **Evidence:** `-`
- **Blocks:** `T-0.11`, `T-0.9`, `T-1.5`

### [ ] T-0.5 — Seed the same 10 products into Store Beta

- **Depends on:** `T-0.2`, `T-0.3`
- **Size:** `M`
- **Why:** §3.1.2 — Beta is the second sync target and must start from identical data.
- **Do:**
  1. Repeat T-0.4 against the Beta admin using the same source file (no independent price edits).
- **Files / artifacts:** none — console step
- **Done when:** Beta shows the same 10 variant SKUs at the same prices as the seed file.
- **Verify:** Beta admin → Products shows 10 items with SKUs matching the seed file; spot-check `SKU-001` price equals the seed value.
- **Evidence:** `-`
- **Blocks:** `T-0.11`, `T-1.5`

### [ ] T-0.6 — Create the Dev Dashboard app and prove it mints an Alpha Admin API token

- **Depends on:** `T-0.2`
- **Size:** `S`
- **Why:** §3.1.3 — without a write-scoped credential there is no way to push prices. Admin-created custom apps can no longer be created, so the credential is a Dev Dashboard app exchanging its own credentials for a token, not a token copied out of a store admin.
- **Do:**
  1. Dev Dashboard → Apps → **Create app** → *Start from Dev Dashboard* → name it (e.g. `Price Sync`) → Create.
  2. **Versions** → create a version: app URL `https://shopify.dev/apps/default-app-home`, Webhooks API version = newest, scopes = `read_products` + `write_products` → **Release**. A released version is required before the app can be installed.
  3. **Home** → **Install app** → select the Alpha store → Install.
  4. **Settings** → copy **Client ID** and **Client secret**; they become `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` in `backend/.env` at T-0.8 (one app covers both stores).
- **Files / artifacts:** none — console step (credentials stored in `backend/.env` at T-0.8)
- **Done when:** the app's credentials mint an Admin API token for Alpha.
- **Verify:** `set -a; . backend/.env; set +a; node backend/scripts/shopify-token.mjs alpha` → `OK alpha (…myshopify.com) token=… scope=read_products,write_products expires_in=86399`, exit 0. A `shop_not_permitted` error means the app and the store are in different organisations (see T-0.2). An **empty `scope=`** (exit 3) is a failure, not a cosmetic detail: the grant reads scopes back from the released app version, and a token with none answers `Access denied for products field`. Fix by releasing a new version that declares the scopes **and** approving the change on the store — releasing alone does not update existing installs.
- **Evidence:** `-`
- **Blocks:** `T-0.8`, `T-0.9`

### [ ] T-0.7 — Install the same app on Beta and prove it mints a Beta token

- **Depends on:** `T-0.2`, `T-0.6`
- **Size:** `S`
- **Why:** §3.1.3 — Beta needs its own installation; the forced-failure test in T-1.15 depends on the two stores failing independently.
- **Do:**
  1. In the same Dev Dashboard app as T-0.6, **Home** → **Install app** → select the Beta store → Install. No second app and no second set of credentials: the client credentials grant scopes a token to whichever store you ask, so one app covering both stores is the intended shape.
- **Files / artifacts:** none — console step (no new `backend/.env` names; `SHOPIFY_BETA_STORE` is T-0.2's)
- **Done when:** the app's credentials mint an Admin API token for Beta.
- **Verify:** `set -a; . backend/.env; set +a; node backend/scripts/shopify-token.mjs beta` → `OK beta (…myshopify.com) token=… expires_in=86399`, exit 0.
- **Evidence:** `-`
- **Blocks:** `T-0.8`

### [x] T-0.8 — Write `backend/.env.example` (placeholder) and `backend/.env` (real, ignored)

- **Depends on:** `T-0.6`, `T-0.7`
- **Size:** `S`
- **Why:** §3.4.1 — the deployment step needs an explicit, complete list of secrets; T-1.2 reads exactly these names.
- **Do:**
  1. Create `backend/.env.example` with every backend row of the Env vars table as `<placeholder>` values, including `SHOPIFY_API_VERSION` pinned to one version string.
  2. Create `backend/.env` with the real store domains, the app's client id/secret, and the Supabase values (until T-0.10 exists, leave those two blank).
- **Files / artifacts:** `backend/.env.example`, `backend/.env`
- **Done when:** both files list all 9 backend variables and `.env` is ignored by git.
- **Verify:** `git check-ignore -v backend/.env` → prints the ignore rule; `cut -d= -f1 backend/.env.example | sort` → all 9 names from the Env vars table.
- **Evidence:** 2026-09-20 — files created at the user's explicit request, ahead of `T-0.6`/`T-0.7`. Both structural checks pass: `git check-ignore -v backend/.env` → `.gitignore:2:.env       backend/.env` (exit 0), and `cut -d= -f1 backend/.env.example | sort` → exactly the 9 Env-vars-table names (count 9), with the same 9 names present in `backend/.env`. `git status --short -uall` lists only `?? backend/.env.example` while `git status --ignored backend/` lists `!! backend/.env`. `SHOPIFY_API_VERSION` pinned to `2026-07`, confirmed "Latest stable" (accessible until 2027-07-16) on `shopify.dev/docs/api/usage/versioning`. Left `[~]`: six values in `backend/.env` are still blank — two of them secret (`SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_CLIENT_SECRET`) and four not (`SUPABASE_URL`, both store domains, `SHOPIFY_CLIENT_ID`) — so `Do` step 2 is unsatisfied. Renamed 2026-09-20: `SHOPIFY_ALPHA_TOKEN`/`SHOPIFY_BETA_TOKEN` became `SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET` (still 9 backend names), because admin-created custom apps can no longer be created — see assumption 1. **Closed 2026-09-20** after the four non-Supabase blanks were filled: both `Verify` commands re-run, `git check-ignore -v backend/.env` → `.gitignore:2:.env       backend/.env` (exit 0) and `cut -d= -f1 backend/.env.example | sort` → the 9 Env-vars names, the name-set `diff` against `grep -E '^[A-Z_]+=' backend/.env | cut -d= -f1 | sort` empty (identical lists). The four Shopify values are real rather than `.env.example` placeholders (checked per-name without printing values), and the nearest live proof is `node backend/scripts/shopify-token.mjs alpha` then `beta` → `OK … token=<masked> scope=read_analytics,…,write_products expires_in=86399`, exit 0 each — so the store domains and client id/secret in the file are genuine and usable. Also corrected the file's own header comment, which still claimed six blanks below it.
- **Deferred:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are still blank, which `Do` step 2 explicitly allows "until T-0.10 exists" — T-0.10 fills them and T-1.2's `config.js` refuses to start until it has.
- **Blocks:** `T-1.2`, `T-3.3`

### [ ] T-0.9 — Prove the SKU→variant lookup works against Alpha

- **Depends on:** `T-0.4`, `T-0.6`
- **Size:** `M`
- **Why:** §3.2.4 Step B — every sync call starts with this lookup; proving the API surface here is the cheapest place to find out the query is wrong.
- **Do:**
  1. Mint a token for Alpha: `set -a; . backend/.env; set +a; TOKEN=$(node backend/scripts/shopify-token.mjs alpha --print)`.
  2. Run a GraphQL Admin API `productVariants(first: 1, query: "sku:SKU-001")` query against Alpha with that token (curl is fine — no app code yet).
  3. Record the returned variant `id` and `price` shape.
- **Files / artifacts:** none — throwaway request (the query string is reused in T-1.5)
- **Done when:** the response contains exactly one variant node for `SKU-001` with its id and current price.
- **Verify:** `curl -s -X POST "https://$SHOPIFY_ALPHA_STORE/admin/api/$SHOPIFY_API_VERSION/graphql.json" -H "X-Shopify-Access-Token: $TOKEN" -H 'Content-Type: application/json' -d '{"query":"{ productVariants(first: 1, query: \"sku:SKU-001\") { edges { node { id price } } } }"}'` returns HTTP 200 and the JSON body has `data.productVariants.edges[0].node.id` non-empty and `node.price` equal to the seeded price for `SKU-001`.
- **Evidence:** `-`
- **Blocks:** `T-1.5`, `T-1.6`

### [ ] T-0.10 — Create the Supabase project and capture the URL + service-role key

- **Depends on:** `T-0.1`
- **Size:** `S`
- **Why:** §3.1.4 — the central store of truth does not exist yet.
- **Do:**
  1. Create a free Supabase project, note the project URL and the service-role (secret) key.
  2. Fill `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into `backend/.env`.
- **Files / artifacts:** `backend/.env` (edit)
- **Done when:** the project is live and the backend `.env` has both values.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}' "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"` → `200`.
- **Evidence:** `-`
- **Blocks:** `T-0.11`, `T-0.12`, `T-0.13`, `T-1.3`

### [ ] T-0.11 — Create the `products` table

- **Depends on:** `T-0.10`
- **Size:** `S`
- **Why:** §3.1.4 — holds SKU, name, and central price.
- **Do:**
  1. In the Supabase SQL editor, create `products` with `sku text primary key`, `name text not null`, `price numeric(10,2) not null`, `updated_at timestamptz not null default now()`.
- **Files / artifacts:** `backend/seed/schema.sql` (kept in-repo so the schema is reproducible)
- **Done when:** the table exists with those four columns.
- **Verify:** `curl -s "$SUPABASE_URL/rest/v1/?apikey=$SUPABASE_SERVICE_ROLE_KEY" | jq -r '.definitions.products.properties | keys[]'` → `name`, `price`, `sku`, `updated_at`.
- **Evidence:** `-`
- **Blocks:** `T-0.12`, `T-0.13`, `T-1.9`

### [ ] T-0.12 — Create the `store_sync_status` table

- **Depends on:** `T-0.11`
- **Size:** `S`
- **Why:** §3.1.4 — per-store, per-SKU live price, last sync timestamp, and sync health; `GET /prices` cannot flag mismatches without it.
- **Do:**
  1. Create `store_sync_status` with `store text not null`, `sku text not null references products(sku) on delete cascade`, `live_price numeric(10,2)`, `status text not null check (status in ('synced','mismatch','failed'))`, `last_synced_at timestamptz`, `error text`, primary key `(store, sku)`.
- **Files / artifacts:** `backend/seed/schema.sql` (append)
- **Done when:** the table exists with that primary key and status constraint.
- **Verify:** `curl -s "$SUPABASE_URL/rest/v1/?apikey=$SUPABASE_SERVICE_ROLE_KEY" | jq -r '.definitions.store_sync_status.properties | keys[]'` → `error`, `last_synced_at`, `live_price`, `sku`, `status`, `store`; inserting `status: 'bogus'` via `POST /rest/v1/store_sync_status` is rejected with a check-constraint error.
- **Evidence:** `-`
- **Blocks:** `T-0.13`, `T-1.9`, `T-1.14`

### [ ] T-0.13 — Insert the 10 SKUs into `products`

- **Depends on:** `T-0.3`, `T-0.11`
- **Size:** `S`
- **Why:** §3.1.4/§1 — the central prices must exist before anything can be compared to them.
- **Do:**
  1. Add one `insert into products (sku, name, price) values (…)` statement with all 10 seed rows to `backend/seed/products.sql` and run it in the SQL editor.
- **Files / artifacts:** `backend/seed/products.sql`
- **Done when:** `products` holds exactly the 10 seeded SKUs with their central prices.
- **Verify:** `curl -s "$SUPABASE_URL/rest/v1/products?select=sku,price&order=sku" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq 'length'` → `10`.
- **Evidence:** `-`
- **Blocks:** `T-1.3`, `T-1.9`, `T-1.17`

### [ ] T-0.14 — Phase 0 smoke test — both stores and the database are reachable with the documented credentials

- **Depends on:** `T-0.6`, `T-0.7`, `T-0.9`, `T-0.13`
- **Size:** `S`
- **Why:** the phase is "environment prepared"; this proves it end to end before any sync code is written on top.
- **Do:**
  1. Re-run the Alpha and Beta token mints, the `SKU-001` variant lookup on both stores, and the `products` count.
- **Files / artifacts:** none
- **Done when:** all four checks pass together using only the variables in `backend/.env`.
- **Verify:** `node backend/scripts/shopify-token.mjs alpha` and `node backend/scripts/shopify-token.mjs beta` → exit 0 each, `SKU-001` variant node returned on both stores, `products` returns 10 rows.
- **Evidence:** `-`
- **Blocks:** `T-1.1`

---

## Phase 1 — Central Backend Service Development

### [ ] T-1.1 — Scaffold the backend Node project

- **Depends on:** `T-0.14`
- **Size:** `S`
- **Why:** §3.2.1 — Express, CORS, and the Supabase client, configured for serverless deployment.
- **Do:**
  1. `npm init -y` in `backend/`, then install `express`, `cors`, `@supabase/supabase-js`, `dotenv`.
  2. Set `"type": "module"` and add `start` / `dev` scripts.
- **Files / artifacts:** `backend/package.json`, `backend/package-lock.json`
- **Done when:** the three named dependencies resolve from `backend/`.
- **Verify:** `cd backend && npm ls --depth=0` lists `express`, `cors`, `@supabase/supabase-js`; `node -e "import('express')"` exits 0.
- **Evidence:** `-`
- **Blocks:** `T-1.2`, `T-1.7`

### [ ] T-1.2 — Add `backend/src/config.js` that fails fast on missing env vars

- **Depends on:** `T-1.1`, `T-0.8`
- **Size:** `S`
- **Why:** a missing Shopify token must be a startup error, not a half-synced store at request time.
- **Do:**
  1. Export `config` reading exactly the names in `backend/.env.example` (via `dotenv`) and throw naming the first missing variable.
- **Files / artifacts:** `backend/src/config.js`
- **Done when:** loading it with a complete `.env` succeeds and reports the variable names (never the values); loading it with one variable removed fails loudly.
- **Verify:** `node -e "import('./backend/src/config.js').then(c=>console.log(Object.keys(c.config).join(',')))"` → lists all keys; `env -u SHOPIFY_CLIENT_SECRET node -e "import('./backend/src/config.js')"` → non-zero exit whose message contains `SHOPIFY_CLIENT_SECRET`.
- **Evidence:** `-`
- **Blocks:** `T-1.3`, `T-1.4`, `T-1.5`

### [ ] T-1.3 — Add the Supabase client module

- **Depends on:** `T-1.2`, `T-0.13`
- **Size:** `S`
- **Why:** §3.2.2 — the shared connection routine the whole query layer uses.
- **Do:**
  1. Export one service-role Supabase client from `backend/src/supabase.js`.
- **Files / artifacts:** `backend/src/supabase.js`
- **Done when:** a query through the module returns seeded rows.
- **Verify:** `node -e "import('./backend/src/supabase.js').then(({supabase})=>supabase.from('products').select('sku')).then(r=>console.log(r.data.length, r.error))"` → `10 null`.
- **Evidence:** `-`
- **Blocks:** `T-1.9`, `T-1.13`

### [ ] T-1.4 — Add the two-store registry

- **Depends on:** `T-1.2`
- **Size:** `S`
- **Why:** §3.2.4 Step B — the sync loop iterates "Store A and Store B configurations"; they must come from one place so T-1.15 can substitute a broken credential.
- **Do:**
  1. Export an array of exactly two store objects: `{ key: 'alpha'|'beta', domain, token }`.
- **Files / artifacts:** `backend/src/stores.js`
- **Done when:** the registry yields two stores with non-empty domains and tokens.
- **Verify:** `node -e "import('./backend/src/stores.js').then(({stores})=>{if(stores.length!==2||stores.some(s=>!s.domain||!s.token))throw new Error('bad registry');console.log(stores.map(s=>s.key).join(','))})"` → `alpha,beta`.
- **Evidence:** `-`
- **Blocks:** `T-1.5`, `T-1.6`, `T-1.14`

### [ ] T-1.5 — Implement `findVariantBySku(sku, store)`

- **Depends on:** `T-0.9`, `T-1.2`, `T-1.4`
- **Size:** `M`
- **Why:** §3.2.4 Step B — locating the variant id per store is the first half of the sync.
- **Do:**
  1. Create `backend/src/shopify.js` exporting `getAccessToken(store)` — the client credentials grant, cached per store until shortly before `expires_in` — and `findVariantBySku(sku, store)` that calls the T-0.9 GraphQL query with `X-Shopify-Access-Token` and returns `{ variantId, price }` or throws a descriptive error when the SKU is absent. The token is minted here, never read from the environment: 24h lifetime, refreshed on demand.
- **Files / artifacts:** `backend/src/shopify.js`
- **Done when:** the function returns the real variant id and current price for a seeded SKU on both stores.
- **Verify:** `node -e "…findVariantBySku('SKU-001', stores[0]).then(console.log)"` → `{ variantId: 'gid://…', price: '<seeded price>' }` for Alpha, and the same for Beta.
- **Evidence:** `-`
- **Blocks:** `T-1.6`, `T-1.14`

### [ ] T-1.6 — Implement `updateVariantPrice(store, variantId, price)`

- **Depends on:** `T-1.5`
- **Size:** `S`
- **Why:** §3.2.4 Step B — the write half of the sync.
- **Do:**
  1. Add `updateVariantPrice(store, variantId, price)` to `backend/src/shopify.js` using a variant price-update mutation/endpoint; throw on a non-success response.
- **Files / artifacts:** `backend/src/shopify.js`
- **Done when:** a real price change round-trips on Alpha.
- **Verify:** call it with price `20.99` for `SKU-001` on Alpha, then re-read via `findVariantBySku` → returns `20.99`; then call it back to the seeded price and re-read → seeded price.
- **Evidence:** `-`
- **Blocks:** `T-1.14`

### [ ] T-1.7 — Create the Express app with CORS, JSON parsing, `/health`

- **Depends on:** `T-1.1`
- **Size:** `M`
- **Why:** §3.2.1 — the base application the two routes attach to; `/health` is what every deployment task verifies against.
- **Do:**
  1. Create `backend/src/app.js` exporting the app: `cors({ origin: config.allowedOrigin })`, `express.json()`, `GET /health` → `{ ok: true }`, and a JSON error handler.
- **Files / artifacts:** `backend/src/app.js`
- **Done when:** the app can be imported and started without side effects.
- **Verify:** `node -e "import('./backend/src/app.js').then(m=>console.log(typeof m.app))"` → `function` (or `object`), and the T-1.8 server's `/health` responds.
- **Evidence:** `-`
- **Blocks:** `T-1.8`, `T-1.10`, `T-1.12`

### [ ] T-1.8 — Add the local server entry point

- **Depends on:** `T-1.7`
- **Size:** `S`
- **Why:** §3.2.1 — a runnable local target for the frontend during Phase 2.
- **Do:**
  1. Create `backend/src/server.js` that imports the app and listens on `config.port`.
  2. Point the `dev`/`start` npm scripts at it.
- **Files / artifacts:** `backend/src/server.js`, `backend/package.json` (edit)
- **Done when:** the server answers locally.
- **Verify:** `node backend/src/server.js` then `curl -s -o /dev/null -w '%{http_code}' localhost:3000/health` → `200`; `curl -s localhost:3000/health` → `{"ok":true}`.
- **Evidence:** `-`
- **Blocks:** `T-1.10`, `T-1.12`, `T-2.3`

### [ ] T-1.9 — Add the query layer `listPrices()`

- **Depends on:** `T-1.3`, `T-0.12`
- **Size:** `M`
- **Why:** §3.2.2/§3.2.3 — fetches the catalogue plus the per-store sync logs that `GET /prices` aggregates.
- **Do:**
  1. Create `backend/src/queries.js` exporting `listPrices()` — one Supabase select over `products` with the related `store_sync_status` rows embedded per SKU (or two selects joined in JS if the relationship is not exposed).
- **Files / artifacts:** `backend/src/queries.js`
- **Done when:** the function returns 10 SKUs, each carrying up to two store status records.
- **Verify:** `node -e "…listPrices().then(r=>console.log(r.length, JSON.stringify(r[0])))"` → `10` and the first item contains the SKU, its central price, and its store status entries.
- **Evidence:** `-`
- **Blocks:** `T-1.10`

### [ ] T-1.10 — Implement `GET /prices` with `has_mismatch`

- **Depends on:** `T-1.9`, `T-1.7`
- **Size:** `M`
- **Why:** §1/§3.2.3 — the read endpoint that flags discrepancies is a headline deliverable.
- **Do:**
  1. Create `backend/src/prices.js` exporting the pure `flagMismatches(rows)` — a store entry is a mismatch when its `status !== 'synced'` or its `live_price !== central price`.
  2. Register `GET /prices` in `backend/src/app.js` returning `[{ sku, name, central_price, stores: { alpha, beta }, has_mismatch }]`.
- **Files / artifacts:** `backend/src/prices.js`, `backend/src/app.js` (edit)
- **Done when:** the endpoint returns all 10 SKUs with both store statuses and a per-SKU flag.
- **Verify:** `curl -s localhost:3000/prices | jq 'length, .[0].sku, .[0].stores.alpha, .[0].has_mismatch'` → `10`, a SKU id, a store object, and a boolean.
- **Evidence:** `-`
- **Blocks:** `T-1.11`, `T-1.17`, `T-2.3`

### [ ] T-1.11 — Add one runnable check for the mismatch logic

- **Depends on:** `T-1.10`
- **Size:** `S`
- **Why:** `rules.md` requires one runnable check for non-trivial logic; `flagMismatches` decides what the dashboard shows and cannot be verified by reading it.
- **Do:**
  1. Create `backend/check-mismatch.js`: a framework-free assert script covering price-equal → `false`, price-differing → `true`, `status: 'failed'` → `true`, and a SKU with no store rows → `true`.
- **Files / artifacts:** `backend/check-mismatch.js`
- **Done when:** the script runs offline and exits 0.
- **Verify:** `node backend/check-mismatch.js` → every case asserts and the process exits 0; temporarily inverting the comparison in `prices.js` makes it exit non-zero.
- **Evidence:** `-`
- **Blocks:** none

### [ ] T-1.12 — Validate `PATCH /prices/:sku` input

- **Depends on:** `T-1.7`
- **Size:** `S`
- **Why:** `rules.md` — input validation at the trust boundary; §3.2.4 takes a price from the network and writes it to two live stores.
- **Do:**
  1. In `backend/src/app.js`, reject a missing/negative/non-numeric/over-2-decimal `price` with 400 and an unknown SKU with 404, before any write.
- **Files / artifacts:** `backend/src/app.js` (edit)
- **Done when:** bad input never reaches Supabase or Shopify.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -d '{"price":"abc"}' localhost:3000/prices/SKU-001` → `400`; `… -d '{"price":-1}'` → `400`; `… -d '{"price":9.99}' localhost:3000/prices/NOPE` → `404`.
- **Evidence:** `-`
- **Blocks:** `T-1.13`

### [ ] T-1.13 — PATCH Step A — write the new central price

- **Depends on:** `T-1.12`, `T-1.3`
- **Size:** `S`
- **Why:** §3.2.4 Step A — the central price is the source of truth and must be recorded.
- **Do:**
  1. Update `products.price` (and `updated_at`) for the SKU, then continue to the sync step.
- **Files / artifacts:** `backend/src/app.js` (edit), `backend/src/queries.js` (edit if the update helper lives there)
- **Done when:** a valid PATCH persists the new central price.
- **Verify:** `curl -s -X PATCH -H 'Content-Type: application/json' -d '{"price":21.50}' localhost:3000/prices/SKU-001` → 2xx, and `curl -s "$SUPABASE_URL/rest/v1/products?sku=eq.SKU-001&select=price" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"` → `21.50`.
- **Evidence:** `-`
- **Blocks:** `T-1.14`, `T-1.18`

### [ ] T-1.14 — PATCH Step B/C (happy path) — sync one store and record `synced`

- **Depends on:** `T-1.6`, `T-1.13`, `T-0.12`
- **Size:** `M`
- **Why:** §3.2.4 Steps B and C — this is the actual propagation, and its success path writes the sync log.
- **Do:**
  1. For each store in the registry: `findVariantBySku` → `updateVariantPrice` → upsert `store_sync_status` with `status: 'synced'`, the new `live_price`, and `last_synced_at`.
- **Files / artifacts:** `backend/src/app.js` (edit), `backend/src/queries.js` (edit for the upsert helper)
- **Done when:** one PATCH updates both stores' live prices and leaves both rows `synced`.
- **Verify:** PATCH `SKU-001` to `22.00` → then Alpha and Beta admin both show `22.00` for `SKU-001` (UI observation), and `curl -s "$SUPABASE_URL/rest/v1/store_sync_status?sku=eq.SKU-001&select=store,status,live_price" …` → two rows, both `synced` / `22.00`.
- **Evidence:** `-`
- **Blocks:** `T-1.15`, `T-1.16`, `T-1.18`

### [ ] T-1.15 — PATCH Step C (failure path) — isolate a store failure

- **Depends on:** `T-1.14`
- **Size:** `M`
- **Why:** §3.2.4 Step C — one store's failure must not roll back or hide the other's success.
- **Do:**
  1. Wrap each store's sync in its own try/catch: on error upsert that store's row as `failed` (or `mismatch` when the store price is known to differ) with the error text, and let the other store's branch complete normally.
- **Files / artifacts:** `backend/src/app.js` (edit), `backend/src/queries.js` (edit)
- **Done when:** a broken credential produces one failed row and one synced row, with the central price still updated.
- **Verify:** break only Beta's credential — point `SHOPIFY_BETA_STORE` at a non-existent store, so Beta's token mint fails while Alpha's is untouched — then PATCH `SKU-002` to `30.00` → Alpha's store price becomes `30.00` (admin observation), `store_sync_status` shows Alpha `synced` and Beta `failed` with a non-null `error`, and `products.price` for `SKU-002` is `30.00`. Restore the variable afterwards.
- **Evidence:** `-`
- **Blocks:** `T-1.16`, `T-1.18`

### [ ] T-1.16 — Return the per-store result from PATCH

- **Depends on:** `T-1.14`, `T-1.15`
- **Size:** `S`
- **Why:** §3.2.4 Step C — the dashboard needs to show which store succeeded, so the response must carry it.
- **Do:**
  1. Respond with `{ sku, price, stores: [{ store, status, error }] }`, using 200 when every store is `synced` and a non-2xx only when all stores failed.
- **Files / artifacts:** `backend/src/app.js` (edit)
- **Done when:** the response body names each store and its outcome.
- **Verify:** rerun the T-1.15 broken-token PATCH and inspect the body → one store `synced`, one `failed` with a message, HTTP status not an outright error.
- **Evidence:** `-`
- **Blocks:** `T-2.5`, `T-2.7`

### [ ] T-1.17 — Add the baseline/refresh script for `store_sync_status`

- **Depends on:** `T-1.10`, `T-1.5`
- **Size:** `M`
- **Why:** §3.1.4/§3.2.3 — `GET /prices` can only flag mismatches against stored live prices, and nothing in the plan populates them before the first PATCH (Open question 3).
- **Do:**
  1. Create `backend/scripts/refresh-status.js`: for each SKU × store, read the live price and upsert `live_price`, `status` (`synced` when equal to the central price, `mismatch` otherwise), and `last_synced_at`, without writing to Shopify.
- **Files / artifacts:** `backend/scripts/refresh-status.js`
- **Done when:** running it fills 20 status rows reflecting the stores' real current prices.
- **Verify:** `node backend/scripts/refresh-status.js` → 20 rows in `store_sync_status`; `curl -s localhost:3000/prices | jq '[.[] | select(.has_mismatch)] | length'` → `0`. Then change one SKU's price in the Alpha admin, re-run, and the same command → `1` with that SKU flagged.
- **Evidence:** `-`
- **Blocks:** `T-1.18`, `T-4.3`

### [ ] T-1.18 — Phase 1 smoke test — one PATCH propagates to both stores and the read endpoint reflects it

- **Depends on:** `T-1.14`, `T-1.15`, `T-1.17`
- **Size:** `S`
- **Why:** proves the backend phase's own deliverable (both routes working together) before the UI is built on it.
- **Do:**
  1. Run T-1.17 to set a clean baseline, PATCH one SKU to a new price, then read `/prices`.
- **Files / artifacts:** none
- **Done when:** all three steps agree.
- **Verify:** `PATCH /prices/SKU-003` to a new value → 2xx; both store admins show the new value; `curl -s localhost:3000/prices | jq '.[] | select(.sku=="SKU-003")'` shows `central_price` equal to the new value, both stores `synced`, `has_mismatch: false`.
- **Evidence:** `-`
- **Blocks:** `T-2.1`

---

## Phase 2 — Frontend Dashboard Development

### [ ] T-2.1 — Scaffold the Next.js frontend with Tailwind

- **Depends on:** `T-1.18`
- **Size:** `M`
- **Why:** §3.3.1 — the layout and styling base for the dashboard.
- **Do:**
  1. Create the Next.js app in `frontend/` (App Router, Tailwind, no extra libraries).
- **Files / artifacts:** `frontend/` (Next.js scaffold files)
- **Done when:** the dev server serves a page locally.
- **Verify:** `cd frontend && npm run dev`, then `curl -s -o /dev/null -w '%{http_code}' localhost:3001/` → `200`.
- **Evidence:** `-`
- **Blocks:** `T-2.2`, `T-2.3`

### [ ] T-2.2 — Add the API client module and `NEXT_PUBLIC_API_URL`

- **Depends on:** `T-2.1`
- **Size:** `S`
- **Why:** §3.3/§3.4.2 — the dashboard must be repointable at the deployed backend without a code change.
- **Do:**
  1. Create `frontend/.env.example` and `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3000`.
  2. Create `frontend/lib/api.ts` exporting `getPrices()` and `updatePrice(sku, price)`.
- **Files / artifacts:** `frontend/lib/api.ts`, `frontend/.env.example`, `frontend/.env.local`
- **Done when:** both helpers call the backend base URL from env, and no secret is referenced client-side.
- **Verify:** `curl -s "$NEXT_PUBLIC_API_URL/prices" | jq 'length'` → `10`; `grep -rn "SUPABASE\|SHOPIFY" frontend/lib frontend/.env.local` → no matches.
- **Evidence:** `-`
- **Blocks:** `T-2.3`, `T-2.5`

### [ ] T-2.3 — Render the price table

- **Depends on:** `T-2.2`, `T-1.10`
- **Size:** `M`
- **Why:** §3.3.2 — the core view: SKU, item name, central price, and one status column per store.
- **Do:**
  1. Add a page that fetches `/prices` server-side and renders one row per SKU with columns SKU, name, central price, Store A, Store B.
- **Files / artifacts:** `frontend/app/page.tsx`
- **Done when:** the page shows all 10 SKUs with both store columns populated.
- **Verify:** load `localhost:3001` in the browser → 10 rows, each showing SKU, name, central price, and both store cells; row count matches `curl -s localhost:3000/prices | jq 'length'`.
- **Evidence:** `-`
- **Blocks:** `T-2.4`, `T-2.5`, `T-2.8`

### [ ] T-2.4 — Add the status badge component

- **Depends on:** `T-2.3`
- **Size:** `S`
- **Why:** §3.3.3 — colour-coded synced / mismatched / failed indicators.
- **Do:**
  1. Create `frontend/components/StatusBadge.tsx` mapping `synced` → green, `mismatch` → yellow, `failed` → red, with the status text and a tooltip/title carrying the error when present.
- **Files / artifacts:** `frontend/components/StatusBadge.tsx`
- **Done when:** each store cell renders a badge driven by the row's status value, not a hard-coded colour.
- **Verify:** with the T-1.15-style failure data present for one SKU, that row's Beta cell shows a red `failed` badge and every other cell shows green `synced` (named UI observation).
- **Evidence:** `-`
- **Blocks:** `T-2.8`

### [ ] T-2.5 — Add the per-row price editor that calls PATCH

- **Depends on:** `T-2.2`, `T-2.3`, `T-1.16`
- **Size:** `M`
- **Why:** §3.3.4 — the action form that triggers the backend patch endpoint.
- **Do:**
  1. Add a client component with a numeric input (pre-filled with the central price) and an Update button per row that calls `updatePrice(sku, price)`; disable the button while the request is in flight.
- **Files / artifacts:** `frontend/components/PriceEditor.tsx`, `frontend/app/page.tsx` (edit)
- **Done when:** submitting a row sends exactly one PATCH for that SKU.
- **Verify:** change `SKU-004` to a new value in the browser and click Update → the backend log shows `PATCH /prices/SKU-004`, and `curl -s "$SUPABASE_URL/rest/v1/products?sku=eq.SKU-004&select=price" …` shows the new value.
- **Evidence:** `-`
- **Blocks:** `T-2.6`, `T-2.7`

### [ ] T-2.6 — Refresh the table after a successful update

- **Depends on:** `T-2.5`
- **Size:** `S`
- **Why:** §3.4.3 — the dashboard must reflect the new central price and store statuses without a manual reload.
- **Do:**
  1. Re-fetch `/prices` (e.g. `router.refresh()` or a client re-fetch) after a successful PATCH response.
- **Files / artifacts:** `frontend/components/PriceEditor.tsx` (edit)
- **Done when:** the visible row updates to the new price and statuses on its own.
- **Verify:** in the browser, update a row and observe without reloading: the central price shows the new value and both badges stay/return to green (named UI observation).
- **Evidence:** `-`
- **Blocks:** `T-2.8`

### [ ] T-2.7 — Surface PATCH errors per store

- **Depends on:** `T-2.5`
- **Size:** `S`
- **Why:** §3.4.3 — "check that mismatches or errors are properly flagged"; the UI is where a reviewer sees it.
- **Do:**
  1. Use the T-1.16 response body to show a message next to the failing store (or a row-level error for a rejected request) instead of a generic failure.
- **Files / artifacts:** `frontend/components/PriceEditor.tsx` (edit)
- **Done when:** a store-level failure and a validation rejection are visually distinguishable.
- **Verify:** with `SHOPIFY_BETA_STORE` pointing at a non-existent store, update a row → the Beta badge turns red and the message names Beta; submitting `abc` as a price shows a validation error and sends no request. Restore the variable afterwards.
- **Evidence:** `-`
- **Blocks:** `T-2.8`

### [ ] T-2.8 — Phase 2 smoke test — dashboard renders and is usable at desktop and mobile widths

- **Depends on:** `T-2.3`, `T-2.4`, `T-2.6`, `T-2.7`
- **Size:** `S`
- **Why:** §3.3.1 — the layout is required to be responsive, which reading the code cannot confirm.
- **Do:**
  1. Load the dashboard in a real browser at 1280px and at 375px width.
- **Files / artifacts:** none
- **Done when:** all 10 rows, both store columns, badges, and the editor are reachable without horizontal scrolling or clipped controls at both widths.
- **Verify:** screenshots at both widths show the table fully readable and the Update button clickable in each row (named UI observation).
- **Evidence:** `-`
- **Blocks:** `T-3.1`

---

## Phase 3 — Deployment

### [ ] T-3.1 — Create the GitHub repo and push both apps

- **Depends on:** `T-0.1`, `T-2.8`
- **Size:** `S`
- **Why:** §3.4.1 — Vercel deploys from a Git repository.
- **Do:**
  1. Create the remote repository and push `backend/` and `frontend/`, confirming no `.env` file is included.
- **Files / artifacts:** `.git/`, remote repo
- **Done when:** the remote holds both apps and no secrets.
- **Verify:** `git ls-files | grep -E '(^|/)\.env$'` → no output; `gh repo view --json name,visibility` reports the repo.
- **Evidence:** `-`
- **Blocks:** `T-3.3`, `T-3.5`

### [ ] T-3.2 — Add the Vercel serverless entry for the Express app

- **Depends on:** `T-1.7`
- **Size:** `S`
- **Why:** §3.2.1/§3.4.1 — the plan requires the backend on Vercel; Express has no default entry point for it (Open question 9).
- **Do:**
  1. Create `backend/api/index.js` exporting the app as the handler.
  2. Create `backend/vercel.json` routing all paths to it and running the build/install from `backend/`.
- **Files / artifacts:** `backend/api/index.js`, `backend/vercel.json`
- **Done when:** the same app object is served locally and as a function.
- **Verify:** `node -e "import('./backend/api/index.js').then(m=>console.log(typeof m.default))"` → `function`.
- **Evidence:** `-`
- **Blocks:** `T-3.3`

### [ ] T-3.3 — Deploy the backend to Vercel with its environment variables

- **Depends on:** `T-3.1`, `T-3.2`, `T-0.8`
- **Size:** `M`
- **Why:** §3.4.1 — "configure all secure environment variables (Supabase keys and Shopify store credentials/tokens)".
- **Do:**
  1. Create the Vercel project from `backend/` and add every server-side variable from the Env vars table in the project settings (never in the repo).
- **Files / artifacts:** Vercel project config (dashboard)
- **Done when:** the deployed backend answers and can reach both Shopify stores and Supabase.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}' https://<backend>.vercel.app/health` → `200`.
- **Evidence:** `-`
- **Blocks:** `T-3.4`, `T-3.5`

### [ ] T-3.4 — Verify the deployed backend routes

- **Depends on:** `T-3.3`
- **Size:** `S`
- **Why:** the local pass does not prove the env vars landed in the deployment.
- **Do:**
  1. Call both routes against the deployed URL.
- **Files / artifacts:** none
- **Done when:** the deployed read route returns real database data.
- **Verify:** `curl -s https://<backend>.vercel.app/prices | jq 'length'` → `10`; `curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -d '{"price":"abc"}' https://<backend>.vercel.app/prices/SKU-001` → `400`.
- **Evidence:** `-`
- **Blocks:** `T-3.5`, `T-4.1`

### [ ] T-3.5 — Deploy the frontend to Vercel pointed at the deployed backend

- **Depends on:** `T-3.3`, `T-3.1`
- **Size:** `M`
- **Why:** §3.4.2 — the dashboard must be reachable without a local server.
- **Do:**
  1. Create the frontend Vercel project from `frontend/`, set `NEXT_PUBLIC_API_URL` to the T-3.3 URL, and deploy.
- **Files / artifacts:** Vercel project config (dashboard)
- **Done when:** the deployed dashboard loads live data.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}' https://<frontend>.vercel.app/` → `200`, and the page in a browser shows 10 rows with both store columns populated.
- **Evidence:** `-`
- **Blocks:** `T-3.6`, `T-4.1`

### [ ] T-3.6 — Restrict CORS to the deployed frontend origin

- **Depends on:** `T-3.5`
- **Size:** `S`
- **Why:** §3.2.1 names CORS explicitly; the deployed API is otherwise callable from any page.
- **Do:**
  1. Set `ALLOWED_ORIGIN` to the T-3.5 URL in the backend Vercel project and redeploy.
- **Files / artifacts:** Vercel env var (dashboard) — the app already reads `config.allowedOrigin` from T-1.7
- **Done when:** browser requests from the dashboard succeed and others are rejected.
- **Verify:** the deployed dashboard updates a row without a CORS error in the console; `curl -s -D- -o /dev/null -H 'Origin: https://example.com' https://<backend>.vercel.app/prices | grep -i access-control-allow-origin` → no matching header for the foreign origin.
- **Evidence:** `-`
- **Blocks:** `T-4.1`

### [ ] T-3.7 — Write the README

- **Depends on:** `T-3.4`, `T-3.5`
- **Size:** `M`
- **Why:** the deliverable is an interview assignment; a reviewer needs the architecture, the env var list, and the run/deploy steps without reading the code.
- **Do:**
  1. Add a root `README.md` covering the architecture (Supabase ← Express → two Shopify stores, Next.js on top), the Env vars table, local run steps, the deployed URLs, and the known simplifications from Open questions.
- **Files / artifacts:** `README.md`
- **Done when:** a reader can run both apps and understand the sync flow from the README alone.
- **Verify:** the README lists every variable in the Env vars table (`grep -c` matches) and both deployed URLs resolve.
- **Evidence:** `-`
- **Blocks:** `T-4.6`

---

## Phase 4 — End-to-end acceptance (maps to the plan's success criteria)

### [ ] T-4.1 — Trigger a price update from the deployed dashboard and confirm the database reflects it

- **Depends on:** `T-3.4`, `T-3.5`, `T-3.6`
- **Size:** `S`
- **Why:** §3.4.3 first bullet and §1 — "automatically propagate price updates when changed centrally", driven from the UI.
- **Do:**
  1. On the deployed dashboard, change one SKU to a clearly new price and submit.
- **Files / artifacts:** none
- **Done when:** the request succeeds and the central price is persisted.
- **Verify:** the UI shows the new price after T-2.6's refresh; `curl -s "$SUPABASE_URL/rest/v1/products?sku=eq.<SKU>&select=price" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"` → the new value.
- **Evidence:** `-`
- **Blocks:** `T-4.2`, `T-4.6`

### [ ] T-4.2 — Confirm both Shopify admin panels show the new price

- **Depends on:** `T-4.1`
- **Size:** `S`
- **Why:** §3.4.3 second bullet — the plan's success criterion is that *both* stores received the update, not just the API call returning 2xx.
- **Do:**
  1. Open the variant for the updated SKU in Store Alpha and Store Beta.
- **Files / artifacts:** none
- **Done when:** both admins show the new value for that SKU.
- **Verify:** Alpha and Beta admin → that variant's price equals the T-4.1 value (named UI observation, both stores); independently `findVariantBySku` returns the same price for both.
- **Evidence:** `-`
- **Blocks:** `T-4.6`

### [ ] T-4.3 — Confirm the read endpoint reports no mismatch for both stores

- **Depends on:** `T-4.1`, `T-1.17`
- **Size:** `S`
- **Why:** §1/§3.2.3 — the visibility criterion: after a successful sync, nothing should be flagged.
- **Do:**
  1. Run the baseline refresh for the updated SKU (or a full refresh) and read the endpoint.
- **Files / artifacts:** none
- **Done when:** the updated SKU reports both stores `synced`.
- **Verify:** `curl -s https://<backend>.vercel.app/prices | jq '.[] | select(.sku=="<SKU>") | {central_price, statuses: [.stores.alpha.status, .stores.beta.status], has_mismatch}'` → both `synced`, `has_mismatch: false`.
- **Evidence:** `-`
- **Blocks:** `T-4.6`

### [ ] T-4.4 — Deliberate failure case — one store fails, the other still syncs

- **Depends on:** `T-4.1`
- **Size:** `M`
- **Why:** §3.4.3 last bullet — "check that mismatches or errors are properly flagged if a simulated network or authentication failure occurs".
- **Do:**
  1. Break one store's credential only (point `SHOPIFY_BETA_STORE` at a non-existent store in the backend env) and update a SKU from the dashboard.
  2. Restore the credential after recording the result.
- **Files / artifacts:** Vercel env var (dashboard) — no code change
- **Done when:** the failure is isolated and visible, and the central price is still recorded.
- **Verify:** Alpha's admin shows the new price; Beta is unchanged; the dashboard shows Beta `failed`/red and Alpha `synced`/green; `products.price` holds the new value. Observed in the UI *and* via `/prices` and the `store_sync_status` rows.
- **Evidence:** `-`
- **Blocks:** `T-4.5`, `T-4.6`

### [ ] T-4.5 — Recovery — restoring the credential returns the store to `synced`

- **Depends on:** `T-4.4`
- **Size:** `S`
- **Why:** the mismatch state must be recoverable, otherwise the "single source of truth" claim only holds until the first error.
- **Do:**
  1. Restore `SHOPIFY_BETA_STORE`, re-submit the same SKU (or run the refresh script), and re-read the status.
- **Files / artifacts:** none
- **Done when:** Beta's price matches central again and its status clears.
- **Verify:** Beta admin shows the central price; `/prices` reports Beta `synced` with `has_mismatch: false` for that SKU.
- **Evidence:** `-`
- **Blocks:** `T-4.6`

### [ ] T-4.6 — Rehearsal — one clean run-through of the whole demo

- **Depends on:** `T-4.1`, `T-4.2`, `T-4.3`, `T-4.4`, `T-4.5`, `T-3.7`
- **Size:** `M`
- **Why:** this is an evaluation; the sequence (dashboard → database → both stores → flagging) has to run without improvising.
- **Do:**
  1. From a clean state, run the full sequence once, timing it: show the dashboard, update a SKU, show both Shopify admins, show `/prices`, then trigger the failure case and the recovery.
  2. Note anything that needed an unplanned step.
- **Files / artifacts:** none (optionally a scripted checklist section in `README.md`)
- **Done when:** the sequence completes unaided, with the failure case and recovery both demonstrated.
- **Verify:** the run covers success, mismatch flagging, and recovery within the demo time box; every value shown matches what the API and the admins report (named observation across dashboard, Supabase, and both stores).
- **Evidence:** `-`
- **Blocks:** none
