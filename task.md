# Task Breakdown — Centralized Price Sync (Task 3)

> Source: `plan.md` · Generated: 2026-09-20 · Status: complete

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
| 0 — Environment & Store Preparation | 14 | 14 / 14 | complete |
| 1 — Central Backend Service Development | 18 | 18 / 18 | complete |
| 2 — Frontend Dashboard Development | 9 | 9 / 9 | complete |
| 3 — Deployment | 7 | 7 / 7 | complete |
| 4 — End-to-end acceptance | 6 | 6 / 6 | complete |
| 5 — Product images | 3 | 3 / 3 | complete |
| 6 — Images & product details in the dashboard | 4 | 4 / 4 | complete |

**Overall:** 61 / 61 done

## Environment variables

| Name | Used by | Where it comes from | Set in |
|---|---|---|---|
| `SUPABASE_URL` | — unused: REST route not taken | Supabase → Project Settings → API | local `backend/.env` only |
| `SUPABASE_SERVICE_ROLE_KEY` | — unused: REST route not taken | Supabase → Project Settings → API (secret) | local `backend/.env` only |
| `SHOPIFY_ALPHA_STORE` | backend | T-0.2 store handle, `<handle>.myshopify.com` | local `backend/.env`, Vercel (backend) |
| `SHOPIFY_BETA_STORE` | backend | T-0.2 store handle | local `backend/.env`, Vercel (backend) |
| `SHOPIFY_CLIENT_ID` | backend | T-0.6 Dev Dashboard app client id — one app, both stores | local `backend/.env`, Vercel (backend) |
| `SHOPIFY_CLIENT_SECRET` | backend | T-0.6 Dev Dashboard app client secret (secret) | local `backend/.env`, Vercel (backend) |
| `SHOPIFY_API_VERSION` | backend | pinned Admin API version string | local `backend/.env`, Vercel (backend) |
| `ALLOWED_ORIGIN` | backend | deployed dashboard URL from T-3.5 (one origin under T-3.3's single project) | local `backend/.env`, Vercel (project) |
| `PORT` | backend | local only | `backend/.env` |
| `PGHOST` | database access (psql/`pg`) | Supabase → Project Settings → Database → Connection pooling, host `aws-<n>-<region>.pooler.supabase.com` | local `backend/.env` |
| `PGPORT` | database access (psql/`pg`) | pooler **session** mode → `5432` | local `backend/.env` |
| `PGDATABASE` | database access (psql/`pg`) | fixed `postgres` | local `backend/.env` |
| `PGUSER` | database access (psql/`pg`) | `postgres.<project-ref>` — the pooler's username form | local `backend/.env` |
| `PGPASSWORD` | database access (psql/`pg`) | Supabase → Project Settings → Database → password (secret) | local `backend/.env` |
| `PGSSLMODE` | database access (psql/`pg`) | `require` — the pooler refuses unencrypted connections | local `backend/.env` |
| `NEXT_PUBLIC_API_URL` | frontend (browser) | T-3.3 project URL — **optional when the dashboard and the API share one deployment**, where T-2.9 makes the browser use relative paths; required for local dev and the two-project fallback | local `frontend/.env.local`, Vercel only in the split shape |
| `API_URL` | frontend (server-side fetches) | **not set by hand** — injected by Vercel from the frontend → backend *service binding*; `http://backend:3000` in `docker-compose.yml` | Vercel (binding), `docker-compose.yml` |

The `PG*` names are the standard libpq contract: `psql`, `pg_dump` and node-postgres read them
from the environment with no glue code, so the database connection needs one secret, not four
values.

**Data layer decided 2026-09-20 (owner):** the backend reaches the Supabase **database** with
node-postgres over the pooler — the same `PG*` contract `psql` already uses — from local dev and
from Vercel alike. `@supabase/supabase-js` and the PostgREST `/rest/v1/` route are **not** used,
so `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` sit in `backend/.env` unused, are not needed in
Vercel (T-3.3), and every `/rest/v1/` `Verify` in this file has been restated as a direct SQL
query. Local and production therefore differ only in the pooler's address, and reachability is
the one already proved at T-0.10 (pooler resolves over IPv4, reached from a container).

`SHOPIFY_CLIENT_SECRET` and `PGPASSWORD` are server-only — they must never appear in a
`NEXT_PUBLIC_*` variable or in client-side code. The Admin API token itself is never stored:
it is minted per store at runtime and cached until it expires (T-1.5).

## Open questions / assumptions

1. **Shopify API surface is not fixed by the plan** (§3.1.3, §3.2.4 say "Custom App or Admin API access tokens"). Assumption: a **Dev Dashboard app** installed on both stores, exchanging `SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET` for a 24h Admin API token per store via the **client credentials grant**, sent as `X-Shopify-Access-Token`; GraphQL Admin API for variant lookup; API version pinned in one place (`SHOPIFY_API_VERSION`, tasks T-0.8/T-1.5). **Revised 2026-09-20:** the plan's other option — an admin-created custom app with a pasted access token — can no longer be created (Shopify's docs: "For new apps, use Dev Dashboard or Shopify CLI"), so the static `SHOPIFY_ALPHA_TOKEN`/`SHOPIFY_BETA_TOKEN` pair this file originally specified was replaced by the two app credentials.
2. **What `GET /prices` compares against.** §3.2.3 says to "aggregate central database records with store sync logs", so the compared value is `store_sync_status.live_price` (last known), not a live per-request Shopify read. Consequence: drift introduced directly in a Shopify admin is only visible after T-1.17 runs. Confirm whether a live read per request is expected instead.
3. **Nothing in the plan populates `store_sync_status` before the first `PATCH`.** Assumption: a refresh script reads live store prices and upserts the baseline (T-1.17), otherwise `GET /prices` has nothing to flag.
4. **`mismatch` vs `failed`.** §3.1.4 names only `synced` / `mismatch`; §3.2.4 also says `mismatch`/`failed`. Assumption: both values exist — `failed` = Shopify call errored, `mismatch` = store price differs from central. Confirm if only two states are wanted.
5. **The 10 SKUs are unspecified** (no identifiers, names, or prices). Assumption: defined in `backend/seed/products.json` (T-0.3) and seeded identically into both stores, using `SKU-001`…`SKU-010` in all verification steps.
6. **No authentication is specified for `PATCH /prices/:sku`.** Assumption: none is added (per `rules.md`, no unrequested features). Flagged as a risk: the route is publicly writable once deployed.
7. **Repo layout is unspecified.** §3.4.1/§3.4.2 allow "separate project or integrated frontend". Assumption: one repo, `backend/` and `frontend/` as sibling Vercel projects. **Revised 2026-09-20 (owner decision):** one repository, **one Vercel deployment**, both apps inside it — using Vercel **Services** (`vercel.com/docs/services`, last updated 2026-08-10: *"deploy multiple backends and frontends within a single Vercel project … replacing the need to split monorepos into separate Vercel projects"*). The sibling-projects reading survives only as the fallback in T-3.3.
8. **Currency.** Assumption: single currency; all prices are 2-decimal `numeric(10,2)` and each store's defaults accept them.
9. **Express on Vercel has no default entry point.** Assumption: a thin serverless adapter is added in T-3.2 rather than switching frameworks.
10. **Data layer.** §3.2.2 says "Supabase client". **Decided 2026-09-20:** node-postgres (`pg`) over the Supabase pooler, not `@supabase/supabase-js` over PostgREST — one credential contract (`PG*`) shared by `psql`, the seed artifacts and the app; no local-only branch; the local engine is the same engine as production. Consequence carried into T-1.1, T-1.2, T-1.3, T-1.9, T-3.3 and the `/rest/v1/` `Verify` lines.

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

### [x] T-0.3 — Define the 10 shared SKUs in a checked-in seed file

- **Depends on:** `T-0.1`
- **Size:** `S`
- **Why:** §1/§3.1.2 — the shared catalogue is the premise of the whole task; it must be identical in both stores.
- **Do:**
  1. Create `backend/seed/products.json` with exactly 10 objects: `{ "sku": "SKU-001", "name": "...", "price": 19.99 }` … `SKU-010`.
- **Files / artifacts:** `backend/seed/products.json`
- **Done when:** the file parses, has 10 unique SKUs, and each entry has a name and a 2-decimal price.
- **Verify:** `node -e "const p=require('./backend/seed/products.json'); const s=new Set(p.map(x=>x.sku)); if(p.length!==10||s.size!==10) throw new Error('expect 10 unique'); console.log(p.map(x=>x.sku).join(','))"` → prints `SKU-001,…,SKU-010`.
- **Evidence:** 2026-09-20 — **verified**. The `Verify` command printed `SKU-001,SKU-002,…,SKU-010` and exited 0. Stronger than the task's own check, the file was diffed against the already-committed `backend/seed/products.sql` (same 10 rows, same names): parsing both gives 10 rows each and `JSON.stringify` of `[sku,name,Number(price)]` for JSON === SQL → `true`, so the two seed artifacts cannot drift silently. Also asserted every `"price":` literal in the file text matches `^[0-9]+\.[0-9]{2}$` (`19.99,12.50,24.00,29.95,45.00,34.75,14.00,39.90,52.00,89.50`) and every entry has a non-empty `name` → `true`/`true`, covering the `Done when` clause the `Verify` command leaves out. Values were taken from `products.sql` rather than invented, and `products.json` carries only the three specified fields.
- **Blocks:** `T-0.4`, `T-0.5`, `T-0.13`, `T-1.17`

### [x] T-0.4 — Seed the 10 products into Store Alpha

- **Depends on:** `T-0.2`, `T-0.3`
- **Size:** `M`
- **Why:** §3.1.2 — Alpha must hold the same SKUs so the sync has a target.
- **Do:**
  1. In the Alpha admin, create the 10 products with a single variant each, setting the variant SKU and price from `backend/seed/products.json` (manual entry or CSV bulk import).
- **Files / artifacts:** none — console step (optional import CSV under `backend/seed/`)
- **Done when:** Alpha products list shows 10 products whose variant SKUs match the seed file exactly.
- **Verify:** Alpha admin → Products shows 10 items; the exported/hand-checked SKU column matches the seed file 1:1 (named UI observation).
- **Evidence:** 2026-09-20 — **verified**. Alpha was empty first (`productsCount` → `0`), so "10 items" is literal. `Do` step 1 was performed through the Admin API (`productSet`, one variant per product, `sku`/`price` read from `backend/seed/products.json`) rather than by hand or CSV: same end state, no admin browser session exists in this agent, and the seeding driver was kept **outside the repo** because this task specifies no artifacts. The 10 products created with their variant ids in one run (`10/10 ok`, e.g. `SKU-001 19.99 gid://shopify/ProductVariant/50472597455098`). Read-back against the seed file — `productsCount=10`, `variants=10`, `seed rows missing/wrong: none`, `extra/duplicate rows: none`, exit 0 — so the SKU column matches 1:1 including prices. Cross-checked independently of the app credential: the CLI's own store session `docker compose run --rm shopify store execute -s alphastore-sdgba8qx.myshopify.com -q 'query { productsCount { count } }'` → `count: 10`, and the same query's `productVariants` listed `SKU-001`…`SKU-010` at the seeded prices. Shape note for whoever restores a store: `productSet` rejects a single-variant product without an explicit option set (`INVALID_VARIABLE … variants.0.optionValues (Expected value to not be null)`), so the input carries `productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }]` and a matching `optionValues` entry; the query string T-0.9 reuses is unaffected.
- **Blocks:** `T-0.11`, `T-0.9`, `T-1.5`

### [x] T-0.5 — Seed the same 10 products into Store Beta

- **Depends on:** `T-0.2`, `T-0.3`
- **Size:** `M`
- **Why:** §3.1.2 — Beta is the second sync target and must start from identical data.
- **Do:**
  1. Repeat T-0.4 against the Beta admin using the same source file (no independent price edits).
- **Files / artifacts:** none — console step
- **Done when:** Beta shows the same 10 variant SKUs at the same prices as the seed file.
- **Verify:** Beta admin → Products shows 10 items with SKUs matching the seed file; spot-check `SKU-001` price equals the seed value.
- **Evidence:** 2026-09-20 — **verified**. Same source file and the same seeding route as T-0.4, against Beta (`betastore-haewq5ha.myshopify.com`, `productsCount` `0` beforehand): `10/10 ok`, `SKU-001 19.99 gid://shopify/ProductVariant/46218659889251` … `SKU-010 89.50`. Read-back diff against `backend/seed/products.json` → `productsCount=10`, `variants=10`, `seed rows missing/wrong: none`, `extra/duplicate rows: none`, exit 0, so the price spot-check for `SKU-001` is `19.99` and no independent price edits exist. Alpha re-read after Beta's run still shows `10 / none / none` (exit 0), so the two stores hold the identical catalogue. **Weaker than T-0.4 on independence:** the CLI's own store session is authenticated for Alpha only (`store auth list` → `alphastore-sdgba8qx  Sep 20, 2026`; `store execute` on Beta answers "Run `shopify store auth --store betastore-haewq5ha.myshopify.com` to authenticate"), so this read uses the same app credential as the write. An independent Beta read needs either that `store auth` approval or the Beta admin UI — both need a browser the agent does not have. Not a blocker for anything downstream, but noted rather than glossed.
- **Blocks:** `T-0.11`, `T-1.5`

### [x] T-0.6 — Create the Dev Dashboard app and prove it mints an Alpha Admin API token

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
- **Evidence:** 2026-09-20 — **verified, with one deviation from the `Verify` line's expected output, stated below.** The `Verify` command ran clean: `node backend/scripts/shopify-token.mjs alpha` → `OK alpha (alphastore-sdgba8qx.myshopify.com) token=<masked> scope=…,write_products,… expires_in=86374`, **exit 0** — so this is a usable credential and not the empty-`scope` case the task defines as failure. Because a mint alone proves nothing (see the scopeless-token note above), the token was then used for a real field read: `HTTP 200` with `{"shop":{"name":"AlphaStore","myshopifyDomain":"alphastore-sdgba8qx.myshopify.com"},"productsCount":{"count":10}}`, and it has a real **write** behind it too — T-0.4 created all 10 products with this exact credential. `Do` steps 1–4 (create the app, release a version with the two scopes, install on Alpha, copy the client id/secret) were performed in the Dev Dashboard in the earlier session this file's assumption 1 describes; they are not re-runnable from the agent, so the durable proof is the credential working end to end plus `backend/.env` (T-0.8, verified). **Deviation:** the granted scope list is not the `read_products,write_products` the `Verify` line names — it carries ~102 scopes (`write_customers`, `write_orders`, `write_themes`, `write_gift_cards`, `read_shopify_payments_*`, `unauthenticated_*`, …). The task only classifies an **empty** scope as failure, and nothing downstream is blocked by the extra grants, so this is recorded as a least-privilege finding rather than reworked here: narrowing it means creating a new app version and having the change **approved on the store** (Shopify does not apply released scopes to an existing install), which is an out-of-band console step. See the report's findings — it does not belong inside this task's `Do` steps.
- **Blocks:** `T-0.8`, `T-0.9`

### [x] T-0.7 — Install the same app on Beta and prove it mints a Beta token

- **Depends on:** `T-0.2`, `T-0.6`
- **Size:** `S`
- **Why:** §3.1.3 — Beta needs its own installation; the forced-failure test in T-1.15 depends on the two stores failing independently.
- **Do:**
  1. In the same Dev Dashboard app as T-0.6, **Home** → **Install app** → select the Beta store → Install. No second app and no second set of credentials: the client credentials grant scopes a token to whichever store you ask, so one app covering both stores is the intended shape.
- **Files / artifacts:** none — console step (no new `backend/.env` names; `SHOPIFY_BETA_STORE` is T-0.2's)
- **Done when:** the app's credentials mint an Admin API token for Beta.
- **Verify:** `set -a; . backend/.env; set +a; node backend/scripts/shopify-token.mjs beta` → `OK beta (…myshopify.com) token=… expires_in=86399`, exit 0.
- **Evidence:** 2026-09-20 — **verified**. `node backend/scripts/shopify-token.mjs beta` → `OK beta (betastore-haewq5ha.myshopify.com) token=<masked> scope=… expires_in=86399`, **exit 0** — the same client id/secret that mints Alpha mints Beta, so `Do` step 1's single-app-both-stores shape holds (no second credential exists in `backend/.env`, which still carries exactly the 9 names T-0.8 verified). As with T-0.6 the mint is only half the check: the token was used for a real field read → `HTTP 200` `{"shop":{"name":"betastore","myshopifyDomain":"betastore-haewq5ha.myshopify.com"},"productsCount":{"count":10}}`, and the installation itself is visible from the token's own perspective — `{ currentAppInstallation { accessScopes { handle } } }` returns a populated scope list for Beta. A **write** stands behind it as well: T-0.5 seeded all 10 Beta products with this credential. Independence caveat carried over from T-0.5: the CLI's store session is authenticated for Alpha only, so Beta has no second credential path to cross-check against — an independent Beta read needs a `store auth` approval or the Beta admin UI (both manual). The ~102-scope least-privilege finding recorded on T-0.6 applies to this installation too.
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
- **Deferred:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are still blank, which `Do` step 2 explicitly allows "until T-0.10 exists" — T-0.10 fills them and T-1.2's `config.js` refuses to start until it has. **Corrected 2026-09-20 (owner decision):** the data layer is node-postgres over the pooler, so T-1.2 no longer requires either name and these two blanks are inert rather than blocking. This task's own `Verify` commands are unchanged and still pass.
- **Blocks:** `T-1.2`, `T-3.3`

### [x] T-0.9 — Prove the SKU→variant lookup works against Alpha

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
- **Evidence:** 2026-09-20 — **verified**. `Do` steps 1–2 run exactly as the `Verify` command writes them (`. backend/.env`, `TOKEN=$(node backend/scripts/shopify-token.mjs alpha --print)`, then the Admin API POST) → **HTTP 200** and `{"data":{"productVariants":{"edges":[{"node":{"id":"gid://shopify/ProductVariant/50472597455098","price":"19.99"}}]}}}`, i.e. exactly one node, non-empty `id`, and `price` `19.99` = the seeded price for `SKU-001` in `backend/seed/products.json` (and the same variant id T-0.4 created, so lookup and seeding agree). **Shape T-1.5 reuses:** `productVariants(first: 1, query: "sku:SKU-001") { edges { node { id price } } }` — `id` is a `gid://shopify/ProductVariant/<numeric>` GID string and `price` comes back as a **string** (`"19.99"`), so the sync has to parse it before comparing against the `numeric(10,2)` central price. Query cost 3 of 4000 available. Alpha only, as the task specifies; T-1.5's own `Verify` covers both stores. Throwaway request — no file left behind, per this task's artifacts line.
- **Blocks:** `T-1.5`, `T-1.6`

### [x] T-0.10 — Create the Supabase project and make it reachable from this repo

- **Depends on:** `T-0.1`
- **Size:** `S`
- **Why:** §3.1.4 — the central store of truth does not exist yet.
- **Do:**
  1. Create a free Supabase project, note its project ref / URL.
  2. Put its credential in `backend/.env` — on the chosen route that is the **database password** for the shared pooler (see the revision note), not a service-role key.

  **Revised 2026-09-20 (owner decision, superseding the plan's wording):** the original text asked for "URL + service-role key", which assumes the app reads Supabase through PostgREST. The owner supplied the project's **pooler** connection string and chose the database route, where the **password alone** reaches the same database, so that is the credential this task closes on. `SUPABASE_URL` was captured too, because it falls out of the project ref for free and keeps the REST route open. Deliberately **not** done here: restating the tasks that still read `/rest/v1/`. Those are named in the evidence below and are a separate pass; this task's own requirement — the project is live and reachable with the credential in `backend/.env` — is met without them.
- **Files / artifacts:** `backend/.env` (edit)
- **Done when:** the project is live and reachable from this repo with the credential in `backend/.env`.
- **Verify:** `timeout 120 docker run --rm --env-file backend/.env postgres:16 psql -w -c 'select current_user, current_database()'` → prints `postgres | postgres` and exits 0. It reads the file's own values, so a wrong host, port, database, user or password fails it. Corroboration that `SUPABASE_URL` is the same project: `curl -s -o /dev/null -w '%{http_code}' "$SUPABASE_URL/rest/v1/"` → `401` (a live project answering an unauthenticated request).
- **Evidence:** 2026-09-20 — **project identified, proved live, and reachable.** The project exists: the pooler connection string the user supplied (`postgres.xnablaneqqhvmuddqroq@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`) carries the project ref in its username, and the REST hostname is always `https://<project-ref>.supabase.co`, so `SUPABASE_URL` was **derived, not guessed**, and then proved live: `curl -s -o /dev/null -w '%{http_code}' https://xnablaneqqhvmuddqroq.supabase.co/rest/v1/` → **401** `{"message":"No API key found in request","hint":"No 'apikey' request header or url param was found."}` — a real project rejecting an unauthenticated call, not a 404. Control `nosuchprojectref000000.supabase.co` fails DNS entirely (`000`, no response body), so the 401 discriminates. Host is IPv4-only (`172.64.149.246`, `104.18.38.10`), so containers and Vercel can reach it. `backend/.env` now holds that URL, and `SUPABASE_SERVICE_ROLE_KEY` is still blank — on the route this task closed on, nothing needs it. The `Verify` the plan originally wrote (an `apikey` header turning that 401 into a 200) is the REST route, which the decision below supersedes: the DB password is a Postgres wire credential rather than an API key, so it reaches the same database, just not through `/rest/v1/`. A new `SUPABASE_DB_*` name was initially declined — it would break T-0.8's verified "exactly the 9 named variables" contract and T-1.2's "reads exactly the names in `.env.example`". The owner then directed it be added, and it went in as the standard `PG*` names below; T-0.8's check was re-run afterwards and still passes, with all 9 original names present. The pooler host does resolve to IPv4 from here (`54.64.190.72`, `35.79.125.133`, `52.68.3.1`), so that route stays open for those tasks if they are run from the repo instead of the SQL editor.
- **Database config added (owner-directed, 2026-09-20):** the pooler parameters are now in `backend/.env`, templated in `backend/.env.example`, under the standard libpq names `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`/`PGSSLMODE` — **every value fixed except `PGPASSWORD`, which is the only thing left to fill in.** No code consumes them yet and none is needed: `psql`, `pg_dump` and node-postgres 8.23.0 (`lib/connection-parameters.js`: `process.env['PG' + key.toUpperCase()]`, and `PGSSLMODE` → SSL) all read that contract straight from the environment. Proved **without** the real password by sending a deliberately wrong one: `docker run --rm -e PGUSER=postgres.xnablaneqqhvmuddqroq -e PGPASSWORD=<wrong> -e PGSSLMODE=require postgres:16 psql -w -c 'select 1'` → `FATAL: password authentication failed for user "postgres"`, i.e. the pooler routed to the right tenant and accepted host/port/database/user/TLS, rejecting only the secret. Control: the same probe with `PGUSER=postgres` (no project ref) → `FATAL: (ENOIDENTIFIER) no tenant identifier provided`, so the `<ref>`-bearing username is required and the two outcomes discriminate. The pooler resolves over IPv4 here (`52.68.3.1`, `54.64.190.72`, `35.79.125.133`), so this works from containers too, unlike `db.<ref>.supabase.co`.
- **Decision taken 2026-09-20 (owner):** the database is reached over the pooler, so the `PG*` values are the project's credential and `SUPABASE_SERVICE_ROLE_KEY` is **not required** — not for this task, and not for Phase 0. Consequences to carry forward, named so the next run does not rediscover them: the `Verify` steps of T-0.11, T-0.12, T-0.13, T-0.14, T-1.3, T-1.9, T-1.13, T-1.14, T-1.15, T-1.17, T-3.4 and T-4.3 still curl `/rest/v1/`, and the data layer named in T-1.1/T-1.3/T-1.9 is still `@supabase/supabase-js` (REST only) rather than `pg` over the pooler; T-3.3's Vercel variable list follows from whichever wins. Those edits are a separate pass and were deliberately not made here. **Applied 2026-09-20 (owner decided the data layer):** the pass was made — T-1.1 installs `pg` instead of `@supabase/supabase-js`, T-1.3 is now the `pg.Pool` module (`backend/src/db.js`), T-1.9 joins two `pg` queries, T-3.3's variable list is the six `PG*` names plus the four `SHOPIFY_*` names and `ALLOWED_ORIGIN`, and every `/rest/v1/` `Verify` named above is restated as a direct SQL query. This task's own `Verify` is unchanged and still passes.
- **Verified 2026-09-20:** the owner filled `PGPASSWORD`, and the restated `Verify` ran green — `docker run --rm --env-file backend/.env postgres:16 psql -w -c 'select current_user, current_database()'` → `postgres | postgres`, **exit 0**, server `PostgreSQL 17.6`; `SUPABASE_URL` from the file answers `401` at `/rest/v1/`, so it is the same live project. The same credential reports the cloud project's `public` schema as holding **0 tables**, i.e. T-0.11–T-0.13 have not been applied there yet. The password's value was never read into the transcript — only its length was measured (`awk -F= '/^PGPASSWORD=/{print length($2)}'` → `16`).
- **Blocks:** `T-0.11`, `T-0.12`, `T-0.13`, `T-1.3`

### [x] T-0.11 — Create the `products` table

- **Depends on:** `T-0.10`
- **Size:** `S`
- **Why:** §3.1.4 — holds SKU, name, and central price.
- **Do:**
  1. In the Supabase SQL editor, create `products` with `sku text primary key`, `name text not null`, `price numeric(10,2) not null`, `updated_at timestamptz not null default now()`.
- **Files / artifacts:** `backend/seed/schema.sql` (kept in-repo so the schema is reproducible)
- **Done when:** the table exists with those four columns.
- **Verify:** `timeout 180 docker run --rm --env-file backend/.env postgres:16 psql -w -c "select column_name from information_schema.columns where table_schema='public' and table_name='products' order by column_name"` → `name`, `price`, `sku`, `updated_at`, exit 0. **Restated 2026-09-20** from the `/rest/v1/` OpenAPI curl the task originally carried: `SUPABASE_SERVICE_ROLE_KEY` is deliberately blank (T-0.10), so the REST route cannot answer, and the pooler is the database credential this project actually holds.
- **Evidence:** 2026-09-20 — **verified**. The cloud project's `public` schema held **0 tables** beforehand (pre-flight `select table_name from information_schema.tables where table_schema='public'` → `(0 rows)`, exit 0), so these four columns are new. `Do` step 1's artifact `backend/seed/schema.sql` already existed from an earlier session, so the work was applying it rather than writing it: `docker run --rm --env-file backend/.env -v <repo>/backend/seed:/seed:ro postgres:16 psql -w -v ON_ERROR_STOP=1 -f /seed/schema.sql` → `CREATE TABLE` `CREATE TABLE`, exit 0. Run over the pooler instead of the SQL editor because the file is the task's own artifact — identical DDL either way, but this route is non-interactive and matches the credential T-0.10 closed on. The restated `Verify` then ran green: `select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='products' order by column_name` → `name text NO`, `price numeric NO`, `sku text NO`, `updated_at timestamp with time zone NO`, exit 0 — the task's expected `name, price, sku, updated_at` exactly, plus the `not null` half of its `Do` steps. The same file also created `store_sync_status` (one artifact, `if not exists` throughout), which T-0.12 verifies on its own terms.
- **Blocks:** `T-0.12`, `T-0.13`, `T-1.9`

### [x] T-0.12 — Create the `store_sync_status` table

- **Depends on:** `T-0.11`
- **Size:** `S`
- **Why:** §3.1.4 — per-store, per-SKU live price, last sync timestamp, and sync health; `GET /prices` cannot flag mismatches without it.
- **Do:**
  1. Create `store_sync_status` with `store text not null`, `sku text not null references products(sku) on delete cascade`, `live_price numeric(10,2)`, `status text not null check (status in ('synced','mismatch','failed'))`, `last_synced_at timestamptz`, `error text`, primary key `(store, sku)`.
- **Files / artifacts:** `backend/seed/schema.sql` (append)
- **Done when:** the table exists with that primary key and status constraint.
- **Verify:** `timeout 180 docker run --rm --env-file backend/.env postgres:16 psql -w -c "select column_name from information_schema.columns where table_schema='public' and table_name='store_sync_status' order by column_name"` → `error`, `last_synced_at`, `live_price`, `sku`, `status`, `store`, exit 0; `… -c "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.store_sync_status'::regclass"` → the `status` check, the `(store, sku)` primary key and the `on delete cascade` foreign key; and a `status: 'bogus'` insert is rejected with a check-constraint error. **Restated 2026-09-20** from the `/rest/v1/` curl for the same reason as T-0.11 — `SUPABASE_SERVICE_ROLE_KEY` is deliberately blank, so the REST route cannot answer.
- **Evidence:** 2026-09-20 — **verified**. The table came from the same `backend/seed/schema.sql` run T-0.11 recorded (one artifact carries both tables, and both tasks name that file), so this task's own work was the verification. Columns: `select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='store_sync_status' order by column_name` → `error text YES`, `last_synced_at timestamp with time zone YES`, `live_price numeric YES`, `sku text NO`, `status text NO`, `store text NO`, exit 0 — the task's expected six names exactly. Structure, which the original `keys[]` check would not have covered: `select contype, pg_get_constraintdef(oid) from pg_constraint where conrelid='public.store_sync_status'::regclass order by contype` → `c CHECK ((status = ANY (ARRAY['synced'::text, 'mismatch'::text, 'failed'::text])))`, `f FOREIGN KEY (sku) REFERENCES products(sku) ON DELETE CASCADE`, `p PRIMARY KEY (store, sku)`, exit 0 — i.e. exactly the primary key and status constraint the `Done when` line names. Rejection test, restated from `POST /rest/v1/store_sync_status` to the same database: `begin; insert into store_sync_status (store, sku, status) values ('alpha','SKU-001','bogus'); rollback;` → `ERROR: new row for relation "store_sync_status" violates check constraint "store_sync_status_status_check"`, exit 1, and the explicit `rollback` means no row was left behind to assert about.
- **Blocks:** `T-0.13`, `T-1.9`, `T-1.14`

### [x] T-0.13 — Insert the 10 SKUs into `products`

- **Depends on:** `T-0.3`, `T-0.11`
- **Size:** `S`
- **Why:** §3.1.4/§1 — the central prices must exist before anything can be compared to them.
- **Do:**
  1. Add one `insert into products (sku, name, price) values (…)` statement with all 10 seed rows to `backend/seed/products.sql` and run it in the SQL editor.
- **Files / artifacts:** `backend/seed/products.sql`
- **Done when:** `products` holds exactly the 10 seeded SKUs with their central prices.
- **Verify:** `timeout 180 docker run --rm --env-file backend/.env postgres:16 psql -w -t -A -c "select count(*) from products"` → `10`, exit 0; and the stored rows diffed against `backend/seed/products.json` → no difference. **Restated 2026-09-20** from the `/rest/v1/products` curl for the same reason as T-0.11/T-0.12 — the service-role key is deliberately blank.
- **Evidence:** 2026-09-20 — **verified**. `Do` step 1's artifact `backend/seed/products.sql` was already complete (its 10 rows were taken from `products.json` at T-0.3 and proved row-for-row identical there), so the work was running it: `psql -w -v ON_ERROR_STOP=1 -f /seed/products.sql` → `INSERT 0 10`, exit 0. Restated `Verify` → `10`, exit 0. Stronger than the count, and covering the `Done when` line's "exactly the 10 seeded SKUs with their central prices": `select sku, name, price from products order by sku` rendered as CSV and diffed against the same three fields built from `backend/seed/products.json` → `IDENTICAL (exit 0)`, so the cloud rows match the checked-in seed 1:1 on sku, name and 2-decimal price. `10` is the expected count and not a lower bound because T-0.11's pre-flight proved the table was empty beforehand.
- **Blocks:** `T-1.3`, `T-1.9`, `T-1.17`

### [x] T-0.14 — Phase 0 smoke test — both stores and the database are reachable with the documented credentials

- **Depends on:** `T-0.6`, `T-0.7`, `T-0.9`, `T-0.13`
- **Size:** `S`
- **Why:** the phase is "environment prepared"; this proves it end to end before any sync code is written on top.
- **Do:**
  1. Re-run the Alpha and Beta token mints, the `SKU-001` variant lookup on both stores, and the `products` count.
- **Files / artifacts:** none
- **Done when:** all four checks pass together using only the variables in `backend/.env`.
- **Verify:** `node backend/scripts/shopify-token.mjs alpha` and `node backend/scripts/shopify-token.mjs beta` → exit 0 each, `SKU-001` variant node returned on both stores, `products` returns 10 rows.
- **Evidence:** 2026-09-20 — **verified**. `Do` step 1 ran as one combined check whose only inputs are the names in `backend/.env` (the smoke-test driver was kept **outside the repo**, in `/tmp`, because this task's artifacts line says *none*): `mint alpha: exit 0`, `mint beta: exit 0`, then the SKU-001 lookup against both stores — `SKU-001 alpha: HTTP 200 id=gid://shopify/ProductVariant/50472597455098 price=19.99` and `SKU-001 beta: HTTP 200 id=gid://shopify/ProductVariant/46218659889251 price=19.99` — and `products count: 10`, ending `PHASE 0 SMOKE TEST PASSED`, **exit 0**. The variant ids are the same ones T-0.4/T-0.5 created and the price is the seeded value for `SKU-001`, so lookup, seeding and the central table agree; the count was taken over the pooler with the file's own `PG*` values (`docker run --rm --env-file backend/.env postgres:16 psql -w -t -A -c "select count(*) from products"`). The driver treats a non-`200`, a missing `id`, a price other than the seeded `19.99` or a count other than `10` as a failure and exits non-zero, so a green run is not just four commands having been typed. Four checks, four green — the phase is prepared.
- **Blocks:** `T-1.1`

---

## Phase 1 — Central Backend Service Development

### [x] T-1.1 — Scaffold the backend Node project

- **Depends on:** `T-0.14`
- **Size:** `S`
- **Why:** §3.2.1 — Express, CORS, and the database client, configured for serverless deployment.
- **Do:**
  1. `npm init -y` in `backend/`, then install `express`, `cors`, `pg`, `dotenv`.
  2. Set `"type": "module"` and add `start` / `dev` scripts.
- **Files / artifacts:** `backend/package.json`, `backend/package-lock.json`
- **Done when:** the three named dependencies resolve from `backend/`.
- **Verify:** `cd backend && npm ls --depth=0` lists `express`, `cors`, `pg`; `node -e "import('express')"` exits 0.
- **Evidence:** 2026-09-20 — **verified**. `Do` steps run as written: `npm init -y` in `backend/`, then `npm install express cors pg dotenv --no-audit --no-fund` → `added 85 packages in 3s`. The committed `backend/package-lock.json` was an **empty stub** (`lockfileVersion 3`, `"packages": {}`, no root deps) and was therefore replaced by npm rather than kept — it declared nothing, so T-1.1 was not partly done as the file's presence suggested. `npm pkg delete main scripts.test` dropped npm-init's `main: index.js` (no such file) and its placeholder `Error: no test specified` script, then `npm pkg set type=module scripts.start="node src/server.js" scripts.dev="node --watch src/server.js"`. `Verify` green: `cd backend && npm ls --depth=0` → `cors@2.8.6`, `dotenv@18.0.1`, `express@5.2.1`, `pg@8.23.0`, **exit 0** with no `extraneous`/`missing` lines, and `node -e "import('express')"` → **exit 0**; `import('pg')` also resolves and exposes `Pool` as a function. `git status --short -uall` shows only `?? backend/package.json` and ` M backend/package-lock.json`; `git check-ignore -v backend/node_modules` → `.gitignore:1:node_modules`, so the installed tree stays untracked. Carried forward: (1) `npm install express` resolves to **express@5.2.1** — path-to-regexp v8, so no bare `*` wildcard routes and no optional-param syntax; nothing in T-1.7/T-1.12 uses either, and Express 5 auto-forwards async handler rejections, which T-1.14/T-1.15's per-store try/catch does not depend on. (2) The `start`/`dev` scripts already name `src/server.js`, so **T-1.8's `Do` step 2 ("point the dev/start npm scripts at it") and its `backend/package.json` edit are already satisfied**; T-1.8 only needs to create the file and confirm.
- **Blocks:** `T-1.2`, `T-1.7`

### [x] T-1.2 — Add `backend/src/config.js` that fails fast on missing env vars

- **Depends on:** `T-1.1`, `T-0.8`
- **Size:** `S`
- **Why:** a missing Shopify token must be a startup error, not a half-synced store at request time.
- **Do:**
  1. Export `config` reading the names the app actually uses — `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE`, the four `SHOPIFY_*` names, `ALLOWED_ORIGIN`, `PORT` — via `dotenv`, and throw naming the first missing one. The two unused `SUPABASE_*` names stay in `.env.example` but are not required (decision 2026-09-20), so the blank `SUPABASE_SERVICE_ROLE_KEY` must not stop startup.
- **Files / artifacts:** `backend/src/config.js`
- **Done when:** loading it with a complete `.env` succeeds and reports the variable names (never the values); loading it with one variable removed fails loudly.
- **Verify:** `node -e "import('./backend/src/config.js').then(c=>console.log(Object.keys(c.config).join(',')))"` → lists all keys; `env SHOPIFY_CLIENT_SECRET= node -e "import('./backend/src/config.js')"` → non-zero exit whose message contains `SHOPIFY_CLIENT_SECRET`. **Restated 2026-09-20** from `env -u SHOPIFY_CLIENT_SECRET …`: `-u` removes the name from the process environment, and this module then refills it from `backend/.env`, so that form loads cleanly (exit 0) and cannot exercise the guard at all. An **empty** value is not overwritten by the loader, so it reaches the check. Both outcomes were measured — see Evidence.
- **Evidence:** 2026-09-20 — **verified**; `backend/src/config.js` created. Shape: one `NAMES` map from the key each module uses to the environment variable behind it (`port`→`PORT`, `allowedOrigin`→`ALLOWED_ORIGIN`, the six `pg*`→`PG*`, the five `shopify*`→`SHOPIFY_*` — the `Do` step says "the four `SHOPIFY_*` names" but the Env-vars table has five, and `shopifyApiVersion` is the one `T-0.9`/`T-1.5` send in the API URL, so it is required), a single `filter` over that map's values which throws naming every missing one at once, and `config` built from the same map via `Object.fromEntries`, so the checked names and the exported object cannot drift. Keys are camelCase rather than the raw environment names because that is the form `T-1.7` (`config.allowedOrigin`) and `T-1.8` (`config.port`) are written against. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are deliberately not in the list (T-0.10 decision), so the blank service-role key does not stop startup. `dotenv.config` is given a **module-relative** path plus `quiet: true`: the file is found from `cwd=<repo root>` *and* from `cwd=backend/`, and dotenv's v17+ "injecting env" banner stays off a check's stdout (the `Verify` command's stdout *is* its result). **Verify 1** → `13 keys: port,allowedOrigin,pgHost,pgPort,pgDatabase,pgUser,pgPassword,pgSslMode,shopifyAlphaStore,shopifyBetaStore,shopifyClientId,shopifyClientSecret,shopifyApiVersion`, exit 0; the same import from `cwd=backend/` → `13 keys`, exit 0; and the two accessors the next tasks use resolve — `config.allowedOrigin` = `http://localhost:3001`, `config.port` = `"3000"` (the string form `listen` accepts). **Verify 2 as written** (`env -u SHOPIFY_CLIENT_SECRET`) → `loaded, no throw`, **exit 0** — it does *not* fail, which is the reason for the restatement above and not a defect in the module. Why, measured rather than assumed: `env -u X node -e "dotenv.config({path:'backend/.env'}); console.log(Boolean(process.env.X))"` → `true` (the loader refilled it from the file), while the same probe with `env X=` → `false`. **Verify 2 restated** (`env SHOPIFY_CLIENT_SECRET=`) → `threw: Missing required environment variable(s): SHOPIFY_CLIENT_SECRET`, **exit 1**, so the fail-fast path is genuinely exercised and the message names the variable. No separate check file: the logic is a filter over a name list and these two commands are the runnable check.
- **Blocks:** `T-1.3`, `T-1.4`, `T-1.5`

### [x] T-1.3 — Add the database module

- **Depends on:** `T-1.2`, `T-0.13`
- **Size:** `S`
- **Why:** §3.2.2 — the shared connection routine the whole query layer uses.
- **Do:**
  1. Export one shared `pg.Pool` from `backend/src/db.js`. No glue code: node-postgres reads `PG*` from the environment by itself. Create the pool at **module scope** so a warm serverless instance reuses it, and keep `max` small — the pooler is in **session** mode, so every held connection occupies one of the project's pool slots for the life of the session.
- **Files / artifacts:** `backend/src/db.js`
- **Done when:** a query through the module returns seeded rows.
- **Verify:** `node --env-file=backend/.env -e "import('./backend/src/db.js').then(({pool})=>pool.query('select sku from products')).then(r=>console.log(r.rows.length))"` → `10`.
- **Evidence:** 2026-09-20 — **verified**. `backend/src/db.js` created: one module-scope `pg.Pool` exported as `pool` with `max: 2`, plus `import './config.js'` for its side effect only — that is what loads `backend/.env`; pg reads `PGHOST`/`PGPORT`/… from the environment itself, so the module carries no connection settings of its own. `Verify` → `10`, exit 0, i.e. all ten seeded `products` rows came back through the pool. **The TLS route needed one deliberate deviation, found by running the command rather than by reading the code:** with the file's own `PGSSLMODE=require` the first attempt failed `Error: self-signed certificate in certificate chain` (`SELF_SIGNED_CERT_IN_CHAIN`). `pg`'s `lib/connection-parameters.js` maps `require`/`verify-ca`/`verify-full` all to `ssl: true`, i.e. full chain verification, while libpq's `require` — what every psql check in this file does — only encrypts; the Supavisor pooler presents a self-signed chain, so psql connected where the app could not. The pool therefore passes pg's own `ssl: 'no-verify'` (which pg translates to `{ rejectUnauthorized: false }`), matching libpq's `require` semantics exactly. Deliberately **not** done: changing `PGSSLMODE` to `no-verify` in `.env` instead, because psql reads the same name and rejects that value (`invalid sslmode value`), which would break every psql `Verify` in this file. An explicit `ssl` wins over the environment, so this stays one option and not glue code. Recorded in the file as a `ponytail:` comment: no CA pinning, upgrade path is shipping Supabase's CA and passing `ssl: { ca }`.
- **Blocks:** `T-1.9`, `T-1.13`

### [x] T-1.4 — Add the two-store registry

- **Depends on:** `T-1.2`
- **Size:** `S`
- **Why:** §3.2.4 Step B — the sync loop iterates "Store A and Store B configurations"; they must come from one place so T-1.15 can substitute a broken credential.
- **Do:**
  1. Export an array of exactly two store objects: `{ key: 'alpha'|'beta', domain }`. **Restated 2026-09-20** (dated note; the original text is kept here so the change is visible): it asked for `{ key, domain, token }`, written before the credential refactor. There is no per-store static token any more — `backend/.env` carries one `SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET` pair covering both stores (assumption 1, revised) and T-1.5 mints each store's token at runtime and caches it until expiry. A `token` field would either be a lie or force this module to depend on T-1.5, which it blocks.
- **Files / artifacts:** `backend/src/stores.js`
- **Done when:** the registry yields two stores with non-empty domains and distinct keys.
- **Verify:** `node -e 'import("./backend/src/stores.js").then(({stores})=>{if(stores.length!==2||stores.some(s=>!s.domain))throw new Error("bad registry");console.log(stores.map(s=>s.key).join(","))})'` → `alpha,beta`. **Restated 2026-09-20** with the `Do` step above: the original asserted a non-empty `s.token` and was single-quoted differently, so in bash it died on history expansion (`!s.domain: event not found`) before it could assert anything.
- **Evidence:** 2026-09-20 — **verified**. `backend/src/stores.js` created: `export const stores = [{ key: 'alpha', domain: config.shopifyAlphaStore }, { key: 'beta', domain: config.shopifyBetaStore }]`, importing `config` for the two domains only, so a broken store domain is substituted by editing `backend/.env` and T-1.15's forced failure still reaches the sync loop through this one place. The restated `Verify` → `alpha,beta`, exit 0. Both keys are distinct and both domains non-empty, and the domains resolve to the two installed stores (`alphastore-sdgba8qx.myshopify.com`, `betastore-haewq5ha.myshopify.com`) — shown by the T-0.14 smoke re-run in this batch, which mints and reads a variant on each using exactly these two names from the same file.
- **Blocks:** `T-1.5`, `T-1.6`, `T-1.14`

### [x] T-1.5 — Implement `findVariantBySku(sku, store)`

- **Depends on:** `T-0.9`, `T-1.2`, `T-1.4`
- **Size:** `M`
- **Why:** §3.2.4 Step B — locating the variant id per store is the first half of the sync.
- **Do:**
  1. Create `backend/src/shopify.js` exporting `getAccessToken(store)` — the client credentials grant, cached per store until shortly before `expires_in` — and `findVariantBySku(sku, store)` that calls the T-0.9 GraphQL query with `X-Shopify-Access-Token` and returns `{ variantId, price }` or throws a descriptive error when the SKU is absent. The token is minted here, never read from the environment: 24h lifetime, refreshed on demand.
- **Files / artifacts:** `backend/src/shopify.js`
- **Done when:** the function returns the real variant id and current price for a seeded SKU on both stores.
- **Verify:** `node -e "…findVariantBySku('SKU-001', stores[0]).then(console.log)"` → `{ variantId: 'gid://…', price: '<seeded price>' }` for Alpha, and the same for Beta.
- **Evidence:** 2026-09-20 — **verified**. `backend/src/shopify.js` created: `getAccessToken(store)` (client credentials grant, cached in a module-level `Map` keyed by `store.key` until `expires_in − 300s`), a private `adminGraphql(store, query)` POST that attaches `X-Shopify-Access-Token` and rejects both a non-2xx status and a `200` body carrying `errors` (Shopify refuses a field with HTTP 200, so a status check alone would read a refusal as an empty catalogue), and `findVariantBySku(sku, store)` running the T-0.9 query with the SKU embedded through `JSON.stringify` — the escaping a GraphQL string literal accepts, so an odd SKU cannot break out of the query. The token is minted here and never read from the environment. `Verify` → `alpha {"variantId":"gid://shopify/ProductVariant/50472597455098","price":"19.99"}` and `beta {"variantId":"gid://shopify/ProductVariant/46218659889251","price":"19.99"}` — the variant ids T-0.4/T-0.5 created and the seeded price, matching T-0.9 — exit 0. The driver is `/tmp/t15_check.mjs`, outside the repo because this task's artifacts line names only `shopify.js`. Two checks beyond the `Verify` line, because the cache and the failure path are not visible in a successful call: a fetch wrapper counting mint POSTs reports **2 mints after one lookup per store** (one each, not one per call) and **still 2 after two further `getAccessToken` calls that return the same token string**, so the cache is doing the work rather than a fresh grant per request; and `findVariantBySku('SKU-DOES-NOT-EXIST', alpha)` throws `alpha: no variant found for sku SKU-DOES-NOT-EXIST` instead of returning an empty result. Carried forward: `price` is a **string** (`"19.99"`), so every comparison against the `numeric(10,2)` central price has to parse it (T-1.14, T-1.17). **Amended 2026-09-20, while doing T-1.6:** the same function now also selects `product { id }` and returns `{ variantId, productId, price }`, because the variant price-write that survives in this API version needs the variant's product (`productVariantUpdate` is not on the `Mutation` type any more). Re-ran this task's check afterwards — `alpha {"variantId":"gid://shopify/ProductVariant/50472597455098","productId":"gid://shopify/Product/9460757725434","price":"19.99"}`, `beta {"variantId":"…46218659889251","productId":"gid://shopify/Product/8483402383459","price":"19.99"}`, `2` mints after one lookup per store, still `2` after two further calls with the same token, absent SKU throws — so the added field changes none of the observations above. Deliberately **not** done: collapsing `backend/scripts/shopify-token.mjs` into a wrapper over this module — that script is T-0.6/T-0.7/T-0.14's verified artifact with its own exit-code contract (0 ok / 1 request failed / 2 missing name / 3 empty scope) and a human-facing diagnosis, so rewriting it was outside this task's scope; the script's own header already documents the pair.
- **Blocks:** `T-1.6`, `T-1.14`

### [x] T-1.6 — Implement `updateVariantPrice(store, variantId, price)`

- **Depends on:** `T-1.5`
- **Size:** `S`
- **Why:** §3.2.4 Step B — the write half of the sync.
- **Do:**
  1. Add `updateVariantPrice(store, variant, price)` to `backend/src/shopify.js` using a variant price-update mutation/endpoint; throw on a non-success response. **Restated 2026-09-20** (dated note; the original wording is kept in the heading): it asked for `updateVariantPrice(store, variantId, price)`, which was written when the variant took its own `id`. Probing the pinned API version showed `productVariantUpdate` is **gone from the `Mutation` type** (`Field 'productVariantUpdate' doesn't exist on type 'Mutation'`, HTTP 200) and the only variant price-write left is `productVariantsBulkUpdate`, which addresses the variant's **product**. So the second argument is the object T-1.5 returns (`{ variantId, productId, price }`), which carries the product id the write needs instead of making the write look it up again.
- **Files / artifacts:** `backend/src/shopify.js`
- **Done when:** a real price change round-trips on Alpha.
- **Verify:** call it with price `20.99` for `SKU-001` on Alpha, then re-read via `findVariantBySku` → returns `20.99`; then call it back to the seeded price and re-read → seeded price.
- **Evidence:** 2026-09-20 — **verified**. Round trip on Alpha, driver `/tmp/t16_check.mjs` (outside the repo; this task's artifacts line names only `shopify.js`): `before: price=19.99 variantId=gid://shopify/ProductVariant/50472597455098 productId=gid://shopify/Product/9460757725434` → `update returned: 20.99` → `re-read after update: 20.99` → `restore returned: 19.99` → `re-read after restore: 19.99`, exit 0 — the store's own answer both times, so the seeded state is restored and no later task inherits a moved price. The drift this task's original signature would have produced was found by probing, not by assumption: `productVariantUpdate(input: {id, price})` answers `HTTP 200` with `Field 'productVariantUpdate' doesn't exist on type 'Mutation'` (`undefinedField`), an introspection of `Mutation` lists `productVariantsBulkUpdate(variants, productId, media, allowPartialUpdates)` as the only price-write, and a call with a bogus `productId` returns `userErrors: [{field:["productId"],message:"Product does not exist"}]` — so the mutation itself is present and only the product id was missing. `updateVariantPrice` sends `String(price)` as the `Money` scalar and throws on both a non-empty `userErrors` and a missing returned variant; that failure path is exercised, not just written: `gid://shopify/ProductVariant/1` → `alpha: price update rejected for gid://shopify/ProductVariant/1: [{"field":["variants","0","id"],"message":"Product variant does not exist"}]`, so a refusal cannot pass as a success. The shared `adminGraphql` helper gained an optional `variables` argument to carry the mutation input — one line, and T-1.5's lookup still goes through the same helper.
- **Blocks:** `T-1.14`

### [x] T-1.7 — Create the Express app with CORS, JSON parsing, `/health`

- **Depends on:** `T-1.1`
- **Size:** `M`
- **Why:** §3.2.1 — the base application the two routes attach to; `/health` is what every deployment task verifies against.
- **Do:**
  1. Create `backend/src/app.js` exporting the app: `cors({ origin: config.allowedOrigin })`, `express.json()`, `GET /health` → `{ ok: true }`, and a JSON error handler.
- **Files / artifacts:** `backend/src/app.js`
- **Done when:** the app can be imported and started without side effects.
- **Verify:** `node -e "import('./backend/src/app.js').then(m=>console.log(typeof m.app))"` → `function` (or `object`), and the T-1.8 server's `/health` responds. **Clarified 2026-09-20:** the `/health` half was taken now by listening this app on `config.port` and fetching it directly, because T-1.8's `server.js` does not exist yet; T-1.8 remains the task that owns the port.
- **Evidence:** 2026-09-20 — **verified**. `backend/src/app.js` created: a named `app` export that never calls `listen` (so importing it has no side effects — T-1.8 owns the port and T-3.2 hands the same object to Vercel), `cors({ origin: config.allowedOrigin })`, `express.json()`, `GET /health` → `{ ok: true }`, and a 4-argument JSON error handler. **Verify part 1** → `typeof m.app = function`, exit 0 — the `Verify` line allows function or object, and Express 5's app is a callable. **Verify part 2** ran rather than being deferred to T-1.8: the app was listened on `config.port` directly in `/tmp/check_app_t17.mjs` → `listening on http://127.0.0.1:3000 (config.port was "3000")`, `/health -> 200 {"ok":true}`, exit 0, which also proves `listen` accepts the string form of `config.port`. The error handler is **proven, not just written**: a malformed body (`POST /health`, `Content-Type: application/json`, `{not json`) → `400 {"error":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}`, so body-parser's `err.status` is honoured and the answer is JSON instead of Express's HTML stack trace. A 5xx stays deliberately generic (`status < 500 ? err.message : 'Internal server error'`) so a database or Shopify failure cannot leak internals to a caller. Driver kept in `/tmp` — this task's artifacts line names only `backend/src/app.js`. Carried forward for T-1.12: Express 5 / path-to-regexp v8 has no bare `*` wildcard route and no optional-param syntax, and async handler rejections are auto-forwarded to this handler, which T-1.14/T-1.15's per-store try/catch does not rely on.
- **Blocks:** `T-1.8`, `T-1.10`, `T-1.12`

### [x] T-1.8 — Add the local server entry point

- **Depends on:** `T-1.7`
- **Size:** `S`
- **Why:** §3.2.1 — a runnable local target for the frontend during Phase 2.
- **Do:**
  1. Create `backend/src/server.js` that imports the app and listens on `config.port`.
  2. Point the `dev`/`start` npm scripts at it.
- **Files / artifacts:** `backend/src/server.js`, `backend/package.json` (edit)
- **Done when:** the server answers locally.
- **Verify:** `node backend/src/server.js` then `curl -s -o /dev/null -w '%{http_code}' localhost:3000/health` → `200`; `curl -s localhost:3000/health` → `{"ok":true}`.
- **Evidence:** 2026-09-20 — **verified**. `backend/src/server.js` created: imports the `app` object and `config`, and listens on `config.port`; nothing else, because T-3.2's serverless entry has to hand over the same app object without a second code path. `Do` step 2 needed no work — `node -e 'console.log(JSON.stringify(require("./backend/package.json").scripts))'` → `{"start":"node src/server.js","dev":"node --watch src/server.js"}`, already pointing at the file (T-1.1 shaped them), so this task edits `package.json` **not at all**. `Verify` → the server logged `backend listening on http://localhost:3000`, then `curl -s -o /dev/null -w '%{http_code}' localhost:3000/health` → **`200`** and `curl -s localhost:3000/health` → **`{"ok":true}`**, both from a real socket against a real process rather than the in-process listen T-1.7 used. Note for the tasks that follow: `start` runs without `--watch`, so an already-running server serves stale code after an edit — restart it (`dev` is the watching variant).
- **Blocks:** `T-1.10`, `T-1.12`, `T-2.3`

### [x] T-1.9 — Add the query layer `listPrices()`

- **Depends on:** `T-1.3`, `T-0.12`
- **Size:** `M`
- **Why:** §3.2.2/§3.2.3 — fetches the catalogue plus the per-store sync logs that `GET /prices` aggregates.
- **Do:**
  1. Create `backend/src/queries.js` exporting `listPrices()` — two `pg` queries joined in JS: all of `products`, and all of `store_sync_status` grouped by SKU. (PostgREST's embedded-resource syntax does not exist on this route.)
- **Files / artifacts:** `backend/src/queries.js`
- **Done when:** the function returns 10 SKUs, each carrying up to two store status records.
- **Verify:** `node -e "…listPrices().then(r=>console.log(r.length, JSON.stringify(r[0])))"` → `10` and the first item contains the SKU, its central price, and its store status entries.
- **Evidence:** 2026-09-20 — **verified**. `backend/src/queries.js` created: `listPrices()` runs the two flat queries concurrently (`products` ordered by sku, `store_sync_status` whole) and groups the status rows by SKU into `stores` keyed by the store name in the row, returning `{ sku, name, central_price, stores }` per product — the shape T-1.10's route output needs. `Verify` → `10 {"sku":"SKU-001","name":"Aero Travel Mug","central_price":"19.99","stores":{}}`, exit 0. `stores` is `{}` because nothing has populated `store_sync_status` yet — correct, and exactly the sparse case T-1.9's `Done when` words as "up to two". Because an empty table cannot show grouping, the driver (`/tmp/t19_check.mjs`, outside the repo — artifacts line names only `queries.js`) inserted two temporary rows for `SKU-001` and re-ran: `"stores":{"alpha":{"live_price":"19.99","status":"synced","last_synced_at":"2026-09-20T10:49:06.353Z","error":null},"beta":{"live_price":"21.00","status":"mismatch","…"}}` with the row count still `10` and `SKU-002` still `{}`, so both stores land under one SKU and no other SKU absorbs them; the two rows were then deleted (`status rows left: 0`) so T-1.17 owns that table and T-1.18 starts from the baseline it sets. Carried into T-1.10: pg returns `numeric(10,2)` as a **string**, so `central_price` and `live_price` compare with `!==` exactly and no float rounding sits in the middle — the drift check does not need to parse either.
- **Blocks:** `T-1.10`

### [x] T-1.10 — Implement `GET /prices` with `has_mismatch`

- **Depends on:** `T-1.9`, `T-1.7`
- **Size:** `M`
- **Why:** §1/§3.2.3 — the read endpoint that flags discrepancies is a headline deliverable.
- **Do:**
  1. Create `backend/src/prices.js` exporting the pure `flagMismatches(rows)` — a store entry is a mismatch when its `status !== 'synced'` or its `live_price !== central price`.
  2. Register `GET /prices` in `backend/src/app.js` returning `[{ sku, name, central_price, stores: { alpha, beta }, has_mismatch }]`.
- **Files / artifacts:** `backend/src/prices.js`, `backend/src/app.js` (edit)
- **Done when:** the endpoint returns all 10 SKUs with both store statuses and a per-SKU flag.
- **Verify:** `curl -s localhost:3000/prices | jq 'length, .[0].sku, .[0].stores.alpha, .[0].has_mismatch'` → `10`, a SKU id, a store object, and a boolean.
- **Evidence:** 2026-09-20 — **verified**. `backend/src/prices.js` created with the pure `flagMismatches(rows)` (a store entry is a mismatch when `status !== 'synced'` **or** `live_price !== central_price`; a SKU whose `stores` object is empty is flagged too, since nothing has confirmed either store holds the central price), and `GET /prices` registered in `backend/src/app.js` as `res.json(flagMismatches(await listPrices()))` — no try/catch, because Express 5 forwards a rejected handler promise to the JSON error handler T-1.7 left in place. `Verify` → `10`, `"SKU-001"`, `null`, `true`, exit 0; `.[0].stores.alpha` is `null` only because `store_sync_status` is still empty, which the fourth value reflects. So the run was repeated with temporary rows through the endpoint (`/tmp/t110_check.mjs`, outside the repo — artifacts line names `prices.js` and `app.js`), giving both statuses and both flag branches: `{"stores":{"alpha":{…,"status":"synced","live_price":"19.99"},"beta":{…,"status":"synced","live_price":"19.99"}},"has_mismatch":false}` for two stores in step, then `"beta":{…,"status":"mismatch","live_price":"21.00"}` with `"has_mismatch":true` once Beta drifted, and `{"stores":{},"has_mismatch":true}` for a SKU no store has reported on. Flagged set at that moment: all ten SKUs (correct — the table was empty), and the temporary rows were deleted afterwards (`status rows left: 0`) so T-1.17 still owns populating it. `central_price` and `live_price` are both pg strings, so the drift comparison is exact and `has_mismatch` cannot be a float-rounding artefact.
- **Blocks:** `T-1.11`, `T-1.17`, `T-2.3`

### [x] T-1.11 — Add one runnable check for the mismatch logic

- **Depends on:** `T-1.10`
- **Size:** `S`
- **Why:** `rules.md` requires one runnable check for non-trivial logic; `flagMismatches` decides what the dashboard shows and cannot be verified by reading it.
- **Do:**
  1. Create `backend/check-mismatch.js`: a framework-free assert script covering price-equal → `false`, price-differing → `true`, `status: 'failed'` → `true`, and a SKU with no store rows → `true`.
- **Files / artifacts:** `backend/check-mismatch.js`
- **Done when:** the script runs offline and exits 0.
- **Verify:** `node backend/check-mismatch.js` → every case asserts and the process exits 0; temporarily inverting the comparison in `prices.js` makes it exit non-zero.
- **Evidence:** 2026-09-20 — **verified**. `backend/check-mismatch.js` created: `node:assert/strict` over `flagMismatches` with the four cases this task names — stores in step at the central price (`false`), one store holding something else (`true`), `status: 'failed'` (`true`), and a SKU with no store rows (`true`). No framework, no fixtures, no database: it imports `./src/prices.js`, which imports nothing, so the check runs offline. `Verify` → `check-mismatch: 4 cases pass`, **exit 0**. The second half of the `Verify` was run rather than assumed: `sed -i 's/status !== /status === /' backend/src/prices.js` → `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: true !== false` at the first case, **exit 1** — so the check really is sensitive to the comparison it is supposed to guard, and not passing by accident. The file was restored from a copy taken first and the md5 is identical either side (`af320319a31c5516803971063349aae5` before and after), so `prices.js` is back to the version T-1.10 verified. Same driver-free pattern as T-0.14: this file is the task's artifact and stays in the repo.
- **Blocks:** none

### [x] T-1.12 — Validate `PATCH /prices/:sku` input

- **Depends on:** `T-1.7`
- **Size:** `S`
- **Why:** `rules.md` — input validation at the trust boundary; §3.2.4 takes a price from the network and writes it to two live stores.
- **Do:**
  1. In `backend/src/app.js`, reject a missing/negative/non-numeric/over-2-decimal `price` with 400 and an unknown SKU with 404, before any write.
- **Files / artifacts:** `backend/src/app.js` (edit)
- **Done when:** bad input never reaches the database or Shopify.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -d '{"price":"abc"}' localhost:3000/prices/SKU-001` → `400`; `… -d '{"price":-1}'` → `400`; `… -d '{"price":9.99}' localhost:3000/prices/NOPE` → `404`.
- **Evidence:** 2026-09-20 — **verified**. `PATCH /prices/:sku` registered in `backend/src/app.js` with one guard: `PRICE_PATTERN = /^\d+(\.\d{1,2})?$/` against the body's `price` (a JSON number is stringified first, because `numeric(10,2)` is spelled as a string everywhere else in this project). `Verify` → `abc `**`400`**, `-1` **`400`**, and `9.99` on an unknown SKU **`404`**; bodies are JSON, not Express's HTML trace: `{"error":"price must be a non-negative number with at most 2 decimals"}` and `{"error":"unknown sku: NOPE"}`. Three boundary cases beyond the `Verify` line, run because each is a separate way the pattern could be wrong: a third decimal `19.999` → **`400`**, an empty body `{}` → **`400`**, and a valid price on a known SKU → **`501`** (the explicit "T-1.13 writes the central price here" placeholder, which T-1.13 replaces — it is deliberately not a fake 2xx). The `Done when` line was checked in the database rather than inferred: after all six requests, `select sku, price, updated_at from products where sku = 'SKU-001'` → `SKU-001|19.99|2026-09-20 10:08:22.270913+00`, i.e. the seeded price and the pre-batch `updated_at`, so no rejected and no accepted request wrote anything. **Files named beyond this task's line:** `backend/src/queries.js` gained the read-only `productExists(sku)` (`select exists (select 1 from products where sku = $1)`), so the 404 gate is one indexed lookup and the SQL stays in the query layer instead of in `app.js`; unspecified and deliberately left alone: no authentication on this route (assumption 6 records the risk) and no format check on the SKU beyond its existence, since the lookup is parameterised.
- **Blocks:** `T-1.13`

### [x] T-1.13 — PATCH Step A — write the new central price

- **Depends on:** `T-1.12`, `T-1.3`
- **Size:** `S`
- **Why:** §3.2.4 Step A — the central price is the source of truth and must be recorded.
- **Do:**
  1. Update `products.price` (and `updated_at`) for the SKU, then continue to the sync step.
- **Files / artifacts:** `backend/src/app.js` (edit), `backend/src/queries.js` (edit if the update helper lives there)
- **Done when:** a valid PATCH persists the new central price.
- **Verify:** `curl -s -X PATCH -H 'Content-Type: application/json' -d '{"price":21.50}' localhost:3000/prices/SKU-001` → 2xx, and `docker run --rm --env-file backend/.env postgres:16 psql -w -t -A -c "select price from products where sku='SKU-001'"` → `21.50`.
- **Evidence:** 2026-09-20 — **verified**. `updateCentralPrice(sku, price)` added to `backend/src/queries.js` — `update products set price = $1, updated_at = now() where sku = $2 returning price` — and the `PATCH` handler's T-1.13 placeholder replaced by it, so the response now reports what the database stored rather than what was asked for. `Verify` → body `{"sku":"SKU-001","price":"21.50"}`, **`status=200`**, and the independent read gives `21.50`, exit 0. The write path is therefore the same row T-1.12's `productExists` gate had already confirmed, and the returned `price` is pg's `numeric(10,2)` string form, so the response, the central row and (from T-1.14) `live_price` all speak the same representation. **Consequence deliberately left for the next task:** the central price of `SKU-001` is now `21.50` while both stores still hold `19.99`, so `GET /prices` reports `has_mismatch: true` for it until T-1.14 propagates a price and writes the sync rows. That is the drift the endpoint exists to show, not a defect — but anything re-verifying between this task and T-1.14 will see it, and T-1.17's baseline is what clears it.
- **Blocks:** `T-1.14`, `T-1.18`

### [x] T-1.14 — PATCH Step B/C (happy path) — sync one store and record `synced`

- **Depends on:** `T-1.6`, `T-1.13`, `T-0.12`
- **Size:** `M`
- **Why:** §3.2.4 Steps B and C — this is the actual propagation, and its success path writes the sync log.
- **Do:**
  1. For each store in the registry: `findVariantBySku` → `updateVariantPrice` → upsert `store_sync_status` with `status: 'synced'`, the new `live_price`, and `last_synced_at`.
- **Files / artifacts:** `backend/src/app.js` (edit), `backend/src/queries.js` (edit for the upsert helper)
- **Done when:** one PATCH updates both stores' live prices and leaves both rows `synced`.
- **Verify:** PATCH `SKU-001` to `22.00` → then Alpha and Beta admin both show `22.00` for `SKU-001` (UI observation), and `docker run --rm --env-file backend/.env postgres:16 psql -w -c "select store, status, live_price from store_sync_status where sku='SKU-001' order by store"` → two rows, both `synced` / `22.00`.
- **Evidence:** 2026-09-20 — **verified**. `syncStore(sku, store, price)` added to `backend/src/app.js` (`findVariantBySku` → `updateVariantPrice` → `recordSyncResult`), the loop runs it for each store in the registry, and `recordSyncResult` was added to `backend/src/queries.js` as an `insert … on conflict (store, sku) do update` — this task's Files line anticipated the upsert living there. `Verify` → `PATCH` answered `200` with `{"sku":"SKU-001","price":"22.00"}`, and the sync log reads `alpha | synced | 22.00` and `beta | synced | 22.00`. The store half of the `Verify` is a **named UI observation**, and this agent has no Shopify admin browser session (recorded at T-0.4/T-0.5), so the nearest live proof was taken instead and the substitution is stated rather than glossed: the Admin API read the variant back as `alpha … "price":"22.00"` and `beta … "price":"22.00"` (`/tmp/t15_check.mjs`, whose first two lines are exactly those reads), and Alpha was cross-checked through an **independent credential** — the CLI's own store session, not the app's — with `docker compose run --rm shopify store execute -s alphastore-sdgba8qx.myshopify.com -q 'query { productVariants(first:1, query:"sku:SKU-001") { edges { node { sku price } } } }'` → `{"sku":"SKU-001","price":"22.00"}`, `Operation succeeded`. So the store price, the central price and `live_price` agree, and the drift T-1.13's note described is cleared. Beta has no second credential path (still the T-0.5 caveat) and the admin UI is the only independent read for it.
- **Blocks:** `T-1.15`, `T-1.16`, `T-1.18`

### [x] T-1.15 — PATCH Step C (failure path) — isolate a store failure

- **Depends on:** `T-1.14`
- **Size:** `M`
- **Why:** §3.2.4 Step C — one store's failure must not roll back or hide the other's success.
- **Do:**
  1. Wrap each store's sync in its own try/catch: on error upsert that store's row as `failed` (or `mismatch` when the store price is known to differ) with the error text, and let the other store's branch complete normally.
- **Files / artifacts:** `backend/src/app.js` (edit), `backend/src/queries.js` (edit)
- **Done when:** a broken credential produces one failed row and one synced row, with the central price still updated.
- **Verify:** break only Beta's credential — point `SHOPIFY_BETA_STORE` at a non-existent store, so Beta's token mint fails while Alpha's is untouched — then PATCH `SKU-002` to `30.00` → Alpha's store price becomes `30.00` (admin observation), `store_sync_status` shows Alpha `synced` and Beta `failed` with a non-null `error`, and `products.price` for `SKU-002` is `30.00`. Restore the variable afterwards.
- **Evidence:** 2026-09-20 — **verified**. `syncStore` now owns §3.2.4 Step C: the lookup and the write sit in one `try`, and the `catch` records the store's own row and returns instead of throwing, so the caller's loop moves on to the other store. The `failed`/`mismatch` wording in the `Do` step is implemented as the difference between a failure **before** the lookup (store price unknown → `failed`, `live_price` null) and a failure **after** it (store price known to differ → `mismatch`, `live_price` carrying the stale price). `Do` step 1 run as written: `.env` copied aside, `SHOPIFY_BETA_STORE` set to `betastore-does-not-exist-9f3a.myshopify.com`, server restarted, then `PATCH /prices/SKU-002 {"price":30.00}` → **`200`** `{"sku":"SKU-002","price":"30.00"}`, and the log read `alpha | synced | 30.00 |` and `beta | failed |  | token request for beta failed: HTTP 404 {"errors":"Not Found"}`, with `select sku, price from products where sku='SKU-002'` → `SKU-002|30.00`. One store's failure therefore neither rolled back the central write nor touched Alpha's branch. **The fake domain resolves and answers `404`, not a DNS error** — worth knowing before writing a future failure test that expects `ENOTFOUND`: the recorded message names the store and the HTTP status, which is what T-2.7 will display. Alpha's price check is again a **named UI observation** with no admin browser session available, so the nearest live proof was used and is stated: the CLI's independent store session returned `{"sku":"SKU-002","price":"30.00"}`, `Operation succeeded`, and the app credential read back `alpha {"variantId":"gid://shopify/ProductVariant/50472598077690",…,"price":"30.00"}`; Beta is unreadable **by construction** in this window, which is exactly why its `live_price` is null. `Do` step 1's restore was verified rather than assumed — `cp` the copy back, `diff -q` → identical, `SHOPIFY_BETA_STORE=betastore-haewq5ha.myshopify.com`, 42 lines as before — and the server was restarted on the restored file. One step beyond the stated scope, said plainly because it is what leaves the workspace consistent: Beta's SKU-002 was still holding its old price, so the same price was PATCHed again after the restore (`{"sku":"SKU-002","price":"30.00"} status=200`) and the log now shows `synced` for `SKU-001` and `SKU-002` on both stores, so T-1.17's baseline starts from stores that agree with the catalogue instead of inheriting this test's drift.
- **Blocks:** `T-1.16`, `T-1.18`

### [x] T-1.16 — Return the per-store result from PATCH

- **Depends on:** `T-1.14`, `T-1.15`
- **Size:** `S`
- **Why:** §3.2.4 Step C — the dashboard needs to show which store succeeded, so the response must carry it.
- **Do:**
  1. Respond with `{ sku, price, stores: [{ store, status, error }] }`, using 200 when every store is `synced` and a non-2xx only when all stores failed.
- **Files / artifacts:** `backend/src/app.js` (edit)
- **Done when:** the response body names each store and its outcome.
- **Verify:** rerun the T-1.15 broken-token PATCH and inspect the body → one store `synced`, one `failed` with a message, HTTP status not an outright error.
- **Evidence:** 2026-09-20 — **verified**. The `PATCH` handler now collects what `syncStore` returns and answers `{ sku, price, stores: [{ store, status, error }] }`; a store that succeeded reports `error: null` so the shape does not vary, and the status code follows the outcomes — `const noStoreSynced = results.every(r => r.status !== 'synced')` → `502` when nothing took the price, `200` otherwise. The `Do` step's "non-2xx only when all stores failed" is deliberately read as "not `synced`", so a `mismatch` row counts as a store that did not take the price. **First half, one store broken:** `.env` copied aside, `SHOPIFY_BETA_STORE` pointed at a non-existent store, `PATCH /prices/SKU-002 {"price":30.00}` → **`status=200`** with `{"sku":"SKU-002","price":"30.00","stores":[{"store":"alpha","status":"synced","error":null},{"store":"beta","status":"failed","error":"token request for beta failed: HTTP 404 {\"errors\":\"Not Found\"}"}]}` — so the body names each store and its outcome, with the failing store's own message, and the request as a whole is not an error. **Second half, both stores broken** (this task's rule, so it was run rather than assumed): `SHOPIFY_ALPHA_STORE` pointed at a non-existent store too, the server restarted, the same PATCH → **`status=502`** with both entries `"status":"failed"` and a per-store message, and the two rows read `alpha | failed |  | token request for alpha failed: HTTP 404 …`, `beta | failed |  | …` — the central price was still written (`SKU-002|30.00`), which is the point of Step C. Deliberately unspecified and chosen here: **`502`** as the all-failed status (there is no 2xx that could describe it, and 502 says "an upstream did not answer", which is what happened), and no per-store HTTP error contract beyond it. `Do` step 2 of T-1.15 was repeated in full — `cp` the copy back, `diff -q` → identical, both `SHOPIFY_*_STORE` names back to `alphastore-sdgba8qx.myshopify.com` / `betastore-haewq5ha.myshopify.com` — and the server was restarted on the restored file. Then, so T-1.17 starts from a coherent workspace, `SKU-002` was PATCHed once more → `{"stores":[{"store":"alpha","status":"synced","error":null},{"store":"beta","status":"synced","error":null}]} status=200`, leaving all four log rows `synced` at the central prices (`SKU-001 22.00`, `SKU-002 30.00`).
- **Blocks:** `T-2.5`, `T-2.7`

### [x] T-1.17 — Add the baseline/refresh script for `store_sync_status`

- **Depends on:** `T-1.10`, `T-1.5`
- **Size:** `M`
- **Why:** §3.1.4/§3.2.3 — `GET /prices` can only flag mismatches against stored live prices, and nothing in the plan populates them before the first PATCH (Open question 3).
- **Do:**
  1. Create `backend/scripts/refresh-status.js`: for each SKU × store, read the live price and upsert `live_price`, `status` (`synced` when equal to the central price, `mismatch` otherwise), and `last_synced_at`, without writing to Shopify.
- **Files / artifacts:** `backend/scripts/refresh-status.js`
- **Done when:** running it fills 20 status rows reflecting the stores' real current prices.
- **Verify:** `node backend/scripts/refresh-status.js` → 20 rows in `store_sync_status`; `curl -s localhost:3000/prices | jq '[.[] | select(.has_mismatch)] | length'` → `0`. Then change one SKU's price in the Alpha admin, re-run, and the same command → `1` with that SKU flagged.
- **Evidence:** 2026-09-20 — **verified**, both halves. `backend/scripts/refresh-status.js` created: for every SKU × store it reads the live price with `findVariantBySku`, then upserts through the same `recordSyncResult` the PATCH route uses — `synced` when the price equals the central one, `mismatch` otherwise — and never sends a price anywhere. Two details the script had to get right: the comparison is `Number(price) === Number(central)` because pg hands `numeric(10,2)` back as a string and Shopify's `Money` is a string too, so `"22.0"` and `"22.00"` are the same price and not a drift; and an unreadable store writes a `failed` row with the error text rather than aborting the run (that path deliberately not exercised here — T-1.15 already proved it). It ends with `pool.end()` and an explicit exit code, because T-1.3 showed the event loop otherwise lingers ~10s on an idle pooled client. **First half** → `20 rows in store_sync_status for 10 SKUs × 2 stores, 0 failed`, exit 0; `curl … | jq '[.[] | select(.has_mismatch)] | length'` → **`0`**; and `select status, count(*) … group by status` → `synced | 20`, so the baseline is complete *and* clean, not merely populated. **Second half** → the `Verify` asks for a price change in the Alpha admin, and again no admin browser session exists in this agent, so the nearest live proof was used and is named: the change was made through the **CLI's own store session**, which is an independent credential rather than the app's own write path — `shopify store execute -s alphastore-sdgba8qx.myshopify.com --allow-mutations -q 'mutation { productVariantsBulkUpdate(productId: "gid://shopify/Product/9460757725434", variants: [{id: "gid://shopify/ProductVariant/50472597455098", price: "24.00"}]) … }'` → `Operation succeeded`, `"price": "24.00"`, `userErrors: []`. Re-running the script → still 20 rows, 0 failed, and `/prices` now flags exactly **one** SKU, quoted in full: `{"sku":"SKU-001","name":"Aero Travel Mug","central_price":"22.00","stores":{"alpha":{"live_price":"24.00","status":"mismatch",…},"beta":{"live_price":"22.00","status":"synced",…}},"has_mismatch":true}` — the drifted store is the mismatched one and the untouched store is still `synced`, which is what the dashboard's two status columns are for. Alpha was then set back to `22.00` through the same CLI path and the script re-run → `20 rows … 0 failed`, `has_mismatch` count `0`, so T-1.18 starts from a baseline where all twenty rows are `synced`.
- **Blocks:** `T-1.18`, `T-4.3`

### [x] T-1.18 — Phase 1 smoke test — one PATCH propagates to both stores and the read endpoint reflects it

- **Depends on:** `T-1.14`, `T-1.15`, `T-1.17`
- **Size:** `S`
- **Why:** proves the backend phase's own deliverable (both routes working together) before the UI is built on it.
- **Do:**
  1. Run T-1.17 to set a clean baseline, PATCH one SKU to a new price, then read `/prices`.
- **Files / artifacts:** none
- **Done when:** all three steps agree.
- **Verify:** `PATCH /prices/SKU-003` to a new value → 2xx; both store admins show the new value; `curl -s localhost:3000/prices | jq '.[] | select(.sku=="SKU-003")'` shows `central_price` equal to the new value, both stores `synced`, `has_mismatch: false`.
- **Evidence:** 2026-09-20 — **verified**. `Do` step 1 ran first: `node backend/scripts/refresh-status.js` → `20 rows in store_sync_status for 10 SKUs × 2 stores, 0 failed`, exit 0, and `/prices` flagged `0`, so the baseline was clean before anything was changed. Then `PATCH /prices/SKU-003 {"price":26.50}` (the seeded `24.00` moved) → **`status=200`** with `{"sku":"SKU-003","price":"26.50","stores":[{"store":"alpha","status":"synced","error":null},{"store":"beta","status":"synced","error":null}]}`, and the read endpoint agrees on every field the `Verify` names: `{"sku":"SKU-003","name":"Merino Crew Socks","central_price":"26.50","stores":{"alpha":{"live_price":"26.50","status":"synced",…},"beta":{"live_price":"26.50","status":"synced",…}},"has_mismatch":false}` — new central price, both stores `synced`, no flag, and `0` flagged overall. The store half of the `Verify` is a named UI observation and this agent still has no admin browser session, so the nearest live proof was taken on both stores and the substitution is stated: the Admin API read back `alpha {"variantId":"gid://shopify/ProductVariant/50472598110458",…,"price":"26.50"}` and `beta {"variantId":"gid://shopify/ProductVariant/46218660511843",…,"price":"26.50"}`, and Alpha was cross-checked through the CLI's **independent** store session → `{"sku":"SKU-003","price":"26.50"}`. Central price, both stores' live prices, both sync rows and the computed flag therefore all agree, which is the phase's own deliverable working end to end. **State left behind for Phase 2:** all twenty `store_sync_status` rows are `synced` with `has_mismatch: false` across the ten SKUs, and two central prices now differ from the seeds (`SKU-001 22.00`, `SKU-002 30.00`, `SKU-003 26.50` — the last is this task's), so any later check quoting the seeded prices for those three must re-read them first.
- **Blocks:** `T-2.1`

---

## Phase 2 — Frontend Dashboard Development

### [x] T-2.1 — Scaffold the Next.js frontend with Tailwind

- **Depends on:** `T-1.18`
- **Size:** `M`
- **Why:** §3.3.1 — the layout and styling base for the dashboard.
- **Do:**
  1. Create the Next.js app in `frontend/` (App Router, Tailwind, no extra libraries).
- **Files / artifacts:** `frontend/` (Next.js scaffold files)
- **Done when:** the dev server serves a page locally.
- **Verify:** `cd frontend && npm run dev`, then `curl -s -o /dev/null -w '%{http_code}' localhost:3001/` → `200`.
- **Evidence:** 2026-09-20 — **verified**. `Do` step 1 run as the official scaffolder rather than by hand: `npx create-next-app@latest frontend --ts --tailwind --eslint --app --empty --use-npm --disable-git --no-agents-md --yes` → `Success! Created frontend at …/frontend`, `added 365 packages`, `found 0 vulnerabilities`. App Router + TypeScript + **Tailwind v4** (`@tailwindcss/postcss`, `app/globals.css` is the single line `@import "tailwindcss"`), and **no library beyond that**: deps are exactly `next@16.3.5`, `react@19.2.8`, `react-dom@19.2.8`, devdeps are the four `@types/*`/`tailwindcss`/`postcss`/`eslint*`/`typescript` entries. `--empty` was used so the page is a placeholder (`<main><div>Hello world!</div></main>`) instead of create-next-app's demo CSS and images — T-2.3 owns the real page, so there is nothing to delete later. `Verify` → **`200`**, from a real socket: `next dev -p 3001` logged `Ready in 356ms`, `curl -s -o /dev/null -w '%{http_code}' localhost:3001/` → `200`, and `curl -s localhost:3001/` returned a full HTML document whose `<link rel="stylesheet">` resolves to a Tailwind chunk (`/_next/static/chunks/app_globals_0yg4wg8.css` → `@layer theme { :root, :host { --font-sans: …`), so the styling base is live and not just declared. **Two deliberate deviations, both named:** (1) the `dev` script is `next dev -p 3001`, not the scaffolder's bare `next dev` — the default is port 3000, which the backend already occupies, and the `Verify` line and `docker-compose.yml`'s frontend service both specify 3001; the script is the one place that makes `npm run dev` mean the port the task asks for (`start` was left alone: Vercel supplies its own port and no task runs it locally). (2) `create-next-app` **refuses a non-empty target directory** (`The directory frontend contains files that could conflict: .dockerignore, Dockerfile`), so the two files this repo already had were moved aside for the scaffold and restored afterwards — both are tracked and `git status` shows them unmodified. `agentRules: false` was added to `frontend/next.config.ts`, with a comment: Next 16 regenerates `frontend/AGENTS.md` + `frontend/CLAUDE.md` on every dev start (it printed so on the first run), and they are not part of this project; after the change a fresh `next dev` starts with no such line and neither file exists. Confirmed also that `node_modules/`, `.next/` and `next-env.d.ts` stay untracked via the scaffold's own `frontend/.gitignore`.
- **Blocks:** `T-2.2`, `T-2.3`

### [x] T-2.2 — Add the API client module and `NEXT_PUBLIC_API_URL`

- **Depends on:** `T-2.1`
- **Size:** `S`
- **Why:** §3.3/§3.4.2 — the dashboard must be repointable at the deployed backend without a code change.
- **Do:**
  1. Create `frontend/.env.example` and `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3000`.
  2. Create `frontend/lib/api.ts` exporting `getPrices()` and `updatePrice(sku, price)`.
- **Files / artifacts:** `frontend/lib/api.ts`, `frontend/.env.example`, `frontend/.env.local`
- **Done when:** both helpers call the backend base URL from env, and no secret is referenced client-side.
- **Verify:** `curl -s "$NEXT_PUBLIC_API_URL/prices" | jq 'length'` → `10`; `grep -rn "SUPABASE\|SHOPIFY" frontend/lib frontend/.env.local` → no matches.
- **Evidence:** 2026-09-20 — **verified**. `frontend/lib/api.ts` created: one module-scope `API_URL = process.env.NEXT_PUBLIC_API_URL`, `getPrices()` checking `response.ok` before `response.json()` so an erroring backend cannot reach the table as an empty catalogue, and `updatePrice(sku, price)` sending one `PATCH` with `{"price": …}` and returning the body **as-is whatever the status** — both outcomes are readable from it, since 200 and 502 both carry `stores[]` (the per-store message T-2.7 shows) and a rejected request carries `error` instead. `frontend/.env.example` and `frontend/.env.local` both hold the literal `NEXT_PUBLIC_API_URL=http://localhost:3000` the `Do` step writes, comment-free. **One strictly-required wiring change, named because it is outside the three files this task lists:** the scaffold's `frontend/.gitignore` carries `.env*`, which swallowed `.env.example` as well, so `!.env.example` was added — without it this task's own named artifact could not be committed (`git status --ignored --short frontend/` → `?? frontend/.env.example`, `!! frontend/.env.local`). `git check-ignore -v frontend/.env.example` is **not** the check to use here: for a negated pattern it prints the `!` line and exits 0, which reads as "ignored" when the file is in fact tracked. **Verify 1** → `10`, using the value sourced from `.env.local`, so the file's own URL answers. **Verify 2** → `no matches`, exit 1. Stronger, because neither `Verify` command proves the module reads the variable: the real module was imported through Node's type stripping and both helpers were called — `/tmp/t22_check.mjs` → `getPrices() length: 10`, `row keys: sku,name,central_price,stores,has_mismatch`, `updatePrice() body: {"sku":"SKU-003","price":"26.50","stores":[{"store":"alpha","status":"synced","error":null},{"store":"beta","status":"synced","error":null}]}`, `T-2.2 CHECK PASSED`, exit 0 — and that write was **idempotent** (the price the row already held), so no store price moved. The `ok` guard is exercised rather than merely written: against a stub server answering `500` → `GET /prices failed: HTTP 500`, and against a dead port → `fetch failed`. `tsc --noEmit -p frontend/tsconfig.json` → clean, exit 0. **Carried forward:** the dev server on 3001 was started **before** `.env.local` existed and `NEXT_PUBLIC_*` is inlined at compile time, so T-2.3 must restart it or the page reads `undefined` as the base URL.
- **Blocks:** `T-2.3`, `T-2.5`

### [x] T-2.3 — Render the price table

- **Depends on:** `T-2.2`, `T-1.10`
- **Size:** `M`
- **Why:** §3.3.2 — the core view: SKU, item name, central price, and one status column per store.
- **Do:**
  1. Add a page that fetches `/prices` server-side and renders one row per SKU with columns SKU, name, central price, Store A, Store B.
- **Files / artifacts:** `frontend/app/page.tsx`
- **Done when:** the page shows all 10 SKUs with both store columns populated.
- **Verify:** load `localhost:3001` in the browser → 10 rows, each showing SKU, name, central price, and both store cells; row count matches `curl -s localhost:3000/prices | jq 'length'`.
- **Evidence:** 2026-09-20 — **verified**. `frontend/app/page.tsx` replaced the scaffold's `Hello world!` placeholder: an async server component that awaits `getPrices()` — T-2.2's client, reused rather than fetching inline — and renders one `<li>` per SKU with the SKU, name, central price and both store status cells. `Verify` → the page loaded in a **real browser** (`localhost:3001`) and its accessibility snapshot lists exactly **10 list items**, each carrying its SKU (`SKU-001`…`SKU-010`), name (`Aero Travel Mug` … `Brass Desk Lamp`), central price and **two** store cells — e.g. `SKU-001 / Aero Travel Mug / 22.00 / synced / synced` and `SKU-010 / Brass Desk Lamp / 89.50 / synced / synced`. The row count matches the backend: `curl -s localhost:3000/prices | jq 'length'` → `10`; and because the page is server-rendered, the HTML itself was checked too — all ten `SKU-0xx` values present and exactly **20** `>synced<` cells (10 rows × 2 stores), so the store columns are populated from real data rather than placeholders. `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json` → exit 0. **Layout choice, forced by T-2.8's "no horizontal scrolling at 375px":** the row is a CSS grid (`md:grid-cols-[4.5rem_minmax(0,1fr)_5rem_7rem_7rem_11rem]`) whose label/value wrappers become `md:contents` at the breakpoint, so one markup gives a phone labelled stacked lines and a desktop six aligned columns; a fixed six-column `<table>` would scroll sideways on a phone. The sixth column is reserved for T-2.5's editor, so that task adds a cell instead of relaying out the row. One change beyond the `Do` step: the payload shape is declared in this file (`PriceRow`) with the store cell read as `p.stores?.alpha?.status ?? 'unknown'` — `tsc` rejected the untyped map callback (TS7006) and the endpoint legitimately returns `stores: {}` for a SKU no store has reported on, so an unguarded read would crash the page rather than show a gap. No type was added to `lib/api.ts`, which T-2.2 owns. Deliberately not shown, per §3.3.2's wording: the stores' `live_price` — the plan asks for one *status* column per store, which is what T-2.4's badge renders.
- **Blocks:** `T-2.4`, `T-2.5`, `T-2.8`

### [x] T-2.4 — Add the status badge component

- **Depends on:** `T-2.3`
- **Size:** `S`
- **Why:** §3.3.3 — colour-coded synced / mismatched / failed indicators.
- **Do:**
  1. Create `frontend/components/StatusBadge.tsx` mapping `synced` → green, `mismatch` → yellow, `failed` → red, with the status text and a tooltip/title carrying the error when present.
- **Files / artifacts:** `frontend/components/StatusBadge.tsx`
- **Done when:** each store cell renders a badge driven by the row's status value, not a hard-coded colour.
- **Verify:** with the T-1.15-style failure data present for one SKU, that row's Beta cell shows a red `failed` badge and every other cell shows green `synced` (named UI observation).
- **Evidence:** 2026-09-20 — **verified**. `frontend/components/StatusBadge.tsx` created: one `Record<string, string>` maps `synced`/`mismatch`/`failed` to the green/yellow/red Tailwind pairs, an unrecognised status falls back to grey (so a value the sync layer invents later cannot silently wear the "fine" colour), the badge prints the status text itself, and `title={error ?? undefined}` carries the store's error when the row has one. Wired into both store cells of `frontend/app/page.tsx` — the edit this task's `Done when` line implies — replacing T-2.3's plain status text. `Verify` → failure data placed for one SKU on an **existing** row (`update store_sync_status set status='failed', error='token request for beta failed: HTTP 404 {"errors":"Not Found"}' where store='beta' and sku='SKU-005'`, no row added, no store touched), page reloaded in the **browser**: SKU-005's Store B cell rendered `failed` and the other nineteen cells all `synced` (20-cell accessibility snapshot). The colour is measured rather than assumed — `getComputedStyle` on the badges returns one fill/text pair for the `synced` badges and a different one for the `failed` badge (background `lab(92.24 10.29 3.84)` vs `lab(96.19 -13.85 6.52)`; positive `a` is red against negative green), and a screenshot of that row shows a light-green `synced` badge beside a light-red `failed` one. The tooltip is live too: the snapshot renders the cell as `generic "token request for beta failed: HTTP 404 {\"errors\":\"Not Found\"}"`. **The injected failure was removed afterwards** — `node backend/scripts/refresh-status.js` → `20 rows in store_sync_status for 10 SKUs × 2 stores, 0 failed`, `synced|20`, SKU-005 beta back to `synced` with a null error, `/prices` flagged `0` — so no later task inherits it. One class beyond the `Do` step, because it is what makes the colour readable: `justify-self-start`, since a grid item stretches to its full column in both the desktop row and the phone's cell, which would have painted a full-width bar instead of a badge.
- **Blocks:** `T-2.8`

### [x] T-2.5 — Add the per-row price editor that calls PATCH

- **Depends on:** `T-2.2`, `T-2.3`, `T-1.16`
- **Size:** `M`
- **Why:** §3.3.4 — the action form that triggers the backend patch endpoint.
- **Do:**
  1. Add a client component with a numeric input (pre-filled with the central price) and an Update button per row that calls `updatePrice(sku, price)`; disable the button while the request is in flight.
- **Files / artifacts:** `frontend/components/PriceEditor.tsx`, `frontend/app/page.tsx` (edit)
- **Done when:** submitting a row sends exactly one PATCH for that SKU.
- **Verify:** change `SKU-004` to a new value in the browser and click Update → the backend log shows `PATCH /prices/SKU-004`, and `docker run --rm --env-file backend/.env postgres:16 psql -w -t -A -c "select price from products where sku='SKU-004'"` shows the new value.
- **Evidence:** 2026-09-20 — **verified**. `frontend/components/PriceEditor.tsx` created (`'use client'`, `useState` for the value and a `pending` flag, and it calls T-2.2's `updatePrice`) and mounted as the row's sixth grid cell in `frontend/app/page.tsx` inside a label wrapper, so the phone's stacked layout keeps it aligned with the values above it. `Verify` → in the **browser**: the SKU-004 input arrived pre-filled with `29.95` (the central price), was changed to `31.95`, and the Update click produced **exactly one** request — `patchRequests: ["PATCH http://localhost:3000/prices/SKU-004"]` after filtering every PATCH the page issued — answering `200` with `{"sku":"SKU-004","price":"31.95","stores":[alpha synced, beta synced]}`; `select sku, price from products where sku='SKU-004'` → `SKU-004|31.95`, and `store_sync_status` reads `alpha|synced|31.95` / `beta|synced|31.95` with both stores' own API answers agreeing (`alpha 31.95`, `beta 31.95`), `/prices` flagged `0`. **Substitution, stated rather than glossed:** the `Verify` line asks for "the backend log", and `backend/src/app.js` has **no request logger** (by design — T-1.7/T-1.8 never added one), so the request was observed at the browser's network layer instead, which is the stronger evidence for this task's own `Done when` ("exactly one PATCH"): a log line proves a request arrived, the request list proves the page sent one and only one. **The in-flight disable was measured, not assumed** — sampling the button every 40ms from the moment the form was submitted gives `40ms|DISABLED|Updating…` … `2840ms|enabled|Update`, so the button is genuinely locked for the whole ~2.8s round trip. (A first attempt sampled once at 250ms and read `enabled`, which was the sampler's timing, not the component's behaviour — the interval sampling is what settled it. `input.press('Enter')` also submits, since the control is a real `<form>`, which is why one input per row needed no keydown handler.) **Data left behind deliberately:** SKU-004's central price is now `31.95` (was the seeded `29.95`) and both stores hold it, so any later check quoting the seed file for SKU-004 must re-read it first; nothing is out of sync.
- **Blocks:** `T-2.6`, `T-2.7`

### [x] T-2.6 — Refresh the table after a successful update

- **Depends on:** `T-2.5`
- **Size:** `S`
- **Why:** §3.4.3 — the dashboard must reflect the new central price and store statuses without a manual reload.
- **Do:**
  1. Re-fetch `/prices` (e.g. `router.refresh()` or a client re-fetch) after a successful PATCH response.
- **Files / artifacts:** `frontend/components/PriceEditor.tsx` (edit)
- **Done when:** the visible row updates to the new price and statuses on its own.
- **Verify:** in the browser, update a row and observe without reloading: the central price shows the new value and both badges stay/return to green (named UI observation).
- **Evidence:** 2026-09-20 — **verified**. `PriceEditor.tsx` now calls `router.refresh()` (from `next/navigation`) after the PATCH, which re-runs T-2.3's server component instead of adding a second, client-side fetch of the same endpoint. It is gated on the response carrying `stores` — that field is present exactly when the central write happened (200 and 502 both carry it; a rejected request carries `error` instead) — so a failed store still refreshes the row and turns its badge red, while a 400 does not re-render. `Verify` → in the **browser**, with no reload between the two reads, SKU-006's row went from `Central35.75` to `Central36.75` with both cells still `Store Asynced` / `Store Bsynced`, `status=200`, and the page still holding `10` rows; the database agrees (`SKU-006|36.75`, `alpha|synced|36.75`, `beta|synced|36.75`, `/prices` flagged `0`). The first run of the same check also repaired the stale row T-2.5 left behind (SKU-004 displayed `29.95` while the database held `31.95`), which is the visible proof the refresh re-reads the server rather than reusing what was already on the screen. **A strictly-required export beyond this task's file, named because it is outside the line:** `export const dynamic = 'force-dynamic'` in `frontend/app/page.tsx`. Running `next build` showed why it is needed — the route was reported as `○ / (Static)`, i.e. prerendered at build time, so a deployed dashboard would have served the prices that existed when Vercel built it, `router.refresh()` would have re-fetched that same frozen payload, and the build itself would have needed a live backend to succeed (a real hazard for T-3.5, which builds the frontend before anything proves the deployed API). One line, in the page whose data is live; after it the same build reports `ƒ / (Dynamic) server-rendered on demand` with `/` generated on demand. **Data left behind:** SKU-006 is now `36.75` (was the seeded `34.75`) on both stores, alongside SKU-004 `31.95` from T-2.5 — later checks quoting the seed file for those SKUs must re-read them.
- **Blocks:** `T-2.8`

### [x] T-2.7 — Surface PATCH errors per store

- **Depends on:** `T-2.5`
- **Size:** `S`
- **Why:** §3.4.3 — "check that mismatches or errors are properly flagged"; the UI is where a reviewer sees it.
- **Do:**
  1. Use the T-1.16 response body to show a message next to the failing store (or a row-level error for a rejected request) instead of a generic failure.
- **Files / artifacts:** `frontend/components/PriceEditor.tsx` (edit)
- **Done when:** a store-level failure and a validation rejection are visually distinguishable.
- **Verify:** with `SHOPIFY_BETA_STORE` pointing at a non-existent store, update a row → the Beta badge turns red and the message names Beta; submitting `abc` as a price shows a validation error and sends no request. Restore the variable afterwards.
- **Evidence:** 2026-09-20 — **verified, both halves.** `PriceEditor.tsx` now keeps a `message`: a request the API **rejected** comes back as `error` (T-1.16's 400/404 body) and is shown on its own, while an **accepted** request carries `stores[]` and each store that did not take the price contributes `${store}: ${error ?? status}`, joined with `·`; a clean sync clears the message. `router.refresh()` moved inside the accepted branch, because a rejected request changes nothing to re-read. So the two failure kinds are distinguishable at a glance: the store-level message always begins with the store's own key, the row-level one never does. **Store-level half** — `backend/.env` copied to `/tmp/backend.env.bak`, `SHOPIFY_BETA_STORE` pointed at `betastore-does-not-exist-9f3a.myshopify.com`, backend restarted (the env is read at startup), page reloaded, SKU-007 submitted with `20.50`: response `200` `{"sku":"SKU-007","price":"20.50","stores":[alpha synced, beta failed …]}`, and in the **browser** Store A stayed a green `synced` badge while Store B's badge rendered **red** `failed` — measured, not eyeballed: background `lab(92.24 10.29 3.84)` for the failed badge against `lab(96.19 -13.85 6.52)` for the still-synced one — with its `title` carrying the error, and the row's message paragraph reading `beta: token request for beta failed: HTTP 404 {"errors":"Not Found"}`, i.e. it names Beta and quotes the store's own reason rather than a generic failure. **Rejection half** — a PATCH-request listener was attached and two invalid prices were submitted: **empty** → `valid: false`, browser message `Please fill out this field.`; **`20.505`** → `valid: false`, `Please enter a valid value. The two nearest valid values are 20.5 and 20.51.`; requests sent: **`[]`** — so the invalid price never left the browser, which is what the `Verify` line asks for. Deviation stated: `abc` cannot be typed into a `<input type="number">` at all (the control discards it and reports an empty value), so the two cases that can actually occur were used instead — an empty value and an over-precise one — and both are blocked **by the platform**, via `required` plus T-2.5's existing `min`/`step`, rather than by a hand-written regex duplicating T-1.12's server-side check. The server-side guard is untouched and remains the trust boundary for direct API calls; the `error` rendering stays as the path for a rejection the input cannot anticipate (e.g. a 404 on a deleted SKU). **Restored afterwards, and verified rather than assumed:** `cp` the backup back, `diff -q` → identical, both `SHOPIFY_*_STORE` names correct, backend restarted, then the same SKU re-PATCHed to its seeded `14.00` → `200` with both stores `synced`; `alpha|synced|14.00` / `beta|synced|14.00`, `products` back to `14.00`, and `/prices` flagged **0** — so T-2.5/T-2.6's data changes are the only ones this batch leaves behind, and the forced failure is gone. **Amended 2026-09-20, after a later `tsc`/`next build`:** the `failed.map((s) => …)` added here had an **implicitly `any` parameter** (TS7006) — `updatePrice` returns the body as `any`, so the filter's annotation did not type the array that `map` walked. Its own `Verify` passed because the browser renders happily from untyped code and `next dev` does not typecheck; **`next build` — which is exactly what Vercel runs — would have failed**, so this was a deployment blocker, not cosmetics. Fixed by declaring the response shape once (`const stores: { store: string; status: string; error?: string | null }[] = result.stores ?? []`), which also documents T-1.16's contract in the component that consumes it; `tsc --noEmit` → exit 0 and `next build` → success. Lesson recorded for the remaining frontend work: a browser `Verify` is not a build check.
- **Blocks:** `T-2.8`

### [x] T-2.8 — Phase 2 smoke test — dashboard renders and is usable at desktop and mobile widths

- **Depends on:** `T-2.3`, `T-2.4`, `T-2.6`, `T-2.7`
- **Size:** `S`
- **Why:** §3.3.1 — the layout is required to be responsive, which reading the code cannot confirm.
- **Do:**
  1. Load the dashboard in a real browser at 1280px and at 375px width.
- **Files / artifacts:** none
- **Done when:** all 10 rows, both store columns, badges, and the editor are reachable without horizontal scrolling or clipped controls at both widths.
- **Verify:** screenshots at both widths show the table fully readable and the Update button clickable in each row (named UI observation).
- **Evidence:** 2026-09-20 — **verified.** `Do` step 1 run in a **real browser** at both widths, with the layout measured rather than eyeballed. **1280×800:** 10 rows, 10 Update buttons, 20 badges (all `synced`), `documentElement.scrollWidth` 1280 = the viewport, so no horizontal overflow, and **zero** clipped controls — every input and button's bounding box lies inside the viewport with a non-zero width. **375×812:** same counts, `scrollWidth` 360 ≤ 375, no overflow, no clipped controls; the accessibility snapshot confirms the phone layout resolves to labelled lines (`SKU-001 / Aero Travel Mug`, `Central 22.00`, `Store A synced`, `Store B synced`, `Update` + input + button) — which is exactly what T-2.3's `md:contents` grid was built for, and why a fixed six-column table was rejected there. Screenshots at both widths show the table fully readable: at 1280 the header row and all ten rows with both badge columns and an Update button each; at 375 the stacked rows with every input and button intact. **"Clickable" was proved by clicking, not by measuring:** at 375px the real SKU-010 Update button was clicked (`clicked: "real click"`) and the page sent `PATCH /prices/SKU-010` → `200` with both stores `synced` — at the current price `89.50`, so the smoke test left **no data change**: afterwards `10` rows / `0` flagged, `synced|20`, and the ten central prices read back exactly as T-2.5/T-2.6/T-2.7 left them (`SKU-004 31.95`, `SKU-006 36.75`, SKU-007 back at its seeded `14.00`). Phase 2's own deliverable — a responsive dashboard that renders live sync data and can drive the sync — therefore works at both widths.
- **Blocks:** `T-3.1`

### [x] T-2.9 — Make the API base URL work when the dashboard and the API share one deployment

- **Depends on:** `T-2.2`
- **Size:** `S`
- **Why:** one deployment means one origin, so the browser must call **relative** paths while a server component must use the API's **internal** address. `frontend/lib/api.ts` read only `NEXT_PUBLIC_API_URL`, which cannot express both — and that is not hypothetical: `docker-compose.yml` already sets `API_URL: http://backend:3000` with the comment that server components need it, and nothing consumed it, so the containerised dashboard could not render at all (`localhost` inside the frontend container is the container, not the backend). Discovered while planning T-3.3.
- **Do:**
  1. In `frontend/lib/api.ts`, pick the base per environment: server-side prefers `API_URL`, the browser uses `NEXT_PUBLIC_API_URL`, and each falls back to the other so a single-variable setup (local dev, two Vercel projects) keeps working unchanged; a relative base is the default when neither is set.
- **Files / artifacts:** `frontend/lib/api.ts` (edit)
- **Done when:** the module resolves the right base for a same-origin deployment, for the split deployment and for local dev, with no caller changing.
- **Verify:** with `API_URL` pointing at one stub and `NEXT_PUBLIC_API_URL` at another, `getPrices()` must read the first; with `API_URL` unset it must read the second; `tsc --noEmit` and `next build` stay clean.
- **Evidence:** 2026-09-20 — **verified**. `frontend/lib/api.ts` now derives two constants: `PUBLIC_API_URL` (`NEXT_PUBLIC_API_URL ?? ''`, so an unset value yields relative paths) and `API_URL` (`process.env.API_URL` server-side, falling back to the public one, trailing slashes trimmed because a binding hands over a base URL). `Verify` → a throwaway driver (`/tmp/t29_check.mjs`, outside the repo) ran two stubs and asserted which one was read: **`API_URL` set with a trailing slash + `NEXT_PUBLIC_API_URL` pointing at a second stub → `getPrices()` returned `via-API_URL`** (so the server-side branch wins and the join is correct); **`API_URL` deleted → the same call returned `via-NEXT_PUBLIC_API_URL`** (so nothing that works today breaks) → `T-2.9 CHECK PASSED`, exit 0. Both stubs assert the request path is exactly `/prices`, so the base is joined once and not doubled. `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json` → exit 0, `npm --prefix frontend run build` → succeeds with `/` still `ƒ (Dynamic)`, and the running dev server still renders **10 SKUs / 20 status cells** from the host setup (`NEXT_PUBLIC_API_URL` unchanged in `frontend/.env.local`), i.e. no existing path regressed. **Deliberately not done:** no `API_URL` fallback was added to `frontend/.env.example` (the browser must never see it — it is not a `NEXT_PUBLIC_*` name), and the compose stack's server-side bug is fixed by this change but not re-verified by running the containers, which would need the host dev servers stopped; that stays a known gap, recorded rather than claimed.
- **Blocks:** `T-3.3`, `T-3.5`

---

## Phase 3 — Deployment

### [x] T-3.1 — Create the GitHub repo and push both apps

- **Depends on:** `T-0.1`, `T-2.8`
- **Size:** `S`
- **Why:** §3.4.1 — Vercel deploys from a Git repository.
- **Do:**
  1. Create the remote repository and push `backend/` and `frontend/`, confirming no `.env` file is included.
- **Files / artifacts:** `.git/`, remote repo
- **Done when:** the remote holds both apps and no secrets.
- **Verify:** `git ls-files | grep -E '(^|/)\.env$'` → no output; `gh repo view --json name,visibility` reports the repo.
- **Evidence:** 2026-09-20 — **verified; the `Do` step had already been performed by the owner, so this task's work was the verification, not the push.** The remote exists — `origin https://github.com/paws1234/technicalexamnodejs.git`, branch `main` tracking `origin/main`, working tree **clean**, and `HEAD` (`19bfe76`) is the same commit as `origin/main` — so both apps are pushed and nothing local is outstanding. `Verify` → command 1, `git ls-files | grep -E '(^|/)\.env$'`, printed **no output**; command 2, `gh repo view paws1234/technicalexamnodejs --json name,visibility,defaultBranchRef` → `{"defaultBranchRef":{"name":"main"},"name":"technicalexamnodejs","visibility":"PUBLIC"}`. **Strengthened, because the `Verify` regex only matches a file named exactly `.env`** and would have missed `.env.local` and any `.env.*`: a wider `git ls-files | grep -E '\.env'` lists **only the three committed templates** (`.env.example`, `backend/.env.example`, `frontend/.env.example` — all placeholder-only), and `git status --ignored --short` shows the three real files as `!!` (`.env`, `backend/.env`, `frontend/.env.local`), so none of them is in the tree and `Done when`'s "no secrets" holds for the wider pattern rather than just the one filename the command names. "The remote holds both apps" was read off the **pushed commit** instead of the working tree — `git ls-tree -r --name-only origin/main` → **21 files under `backend/`** and **17 under `frontend/`** (plus `docker-compose.yml`, `plan.md`, `task.md`, `README.md`, `.gitignore`, `tools/`) — so the API and the dashboard are both on GitHub, which is what T-3.3/T-3.5 will build from. Recorded rather than changed: the repo is **PUBLIC** — the task fixes no visibility and the tree is secret-free, so it is an observation, not a defect. This task's own dependencies were re-checked in the same pass: T-0.1 `git check-ignore -v backend/node_modules .env frontend/.next` → the three ignore rules (`.gitignore:1:node_modules`, `.gitignore:2:.env`, `frontend/.gitignore:17:/.next/`), exit 0; and T-2.8's dashboard re-measured at **1280px and 375px** → 10 rows / 10 Update buttons / 20 badges, **no horizontal overflow** at either width. T-3.1 was the last code-only task in Phase 3; everything after it (T-3.3 onward) needs the Vercel dashboard, and the `vercel` CLI is not installed here, so those stay `needs manual`.
- **Blocks:** `T-3.3`, `T-3.5`

### [x] T-3.2 — Add the Vercel serverless entry for the Express app

- **Depends on:** `T-1.7`
- **Size:** `S`
- **Why:** §3.2.1/§3.4.1 — the plan requires the backend on Vercel; Express has no default entry point for it (Open question 9).
- **Do:**
  1. Create `backend/api/index.js` exporting the app as the handler.
  2. Create `backend/vercel.json` routing all paths to it and running the build/install from `backend/`.
- **Files / artifacts:** `backend/api/index.js`, `backend/vercel.json`
- **Done when:** the same app object is served locally and as a function.
- **Verify:** `node -e "import('./backend/api/index.js').then(m=>console.log(typeof m.default))"` → `function`.
- **Evidence:** 2026-09-20 — **verified.** `backend/api/index.js` is three lines: `import { app } from '../src/app.js'` and `export default app`. No adapter, no second `express()` call and no route of its own, because an Express app already is a `(req, res)` handler — this is the whole reason T-1.7 exported the app object instead of calling `listen`. `backend/vercel.json` is one rewrite, `{"rewrites":[{"source":"/(.*)","destination":"/api"}]}`, which is what makes `/health` and `/prices` reach the function rather than Vercel's static-file 404. **`Verify` as written** → `function`, exit 0. Strengthened, because "is a function" does not prove `Done when`'s "the same app object": a throwaway driver in `/tmp/t32_check.mjs` (this task's artifacts line names only the two files, so nothing else landed in the repo) asserted `handler === app` → **true**, i.e. identity with the object `src/server.js` listens on locally, and then handed the default export to `http.createServer(handler)` — exactly what Vercel's Node runtime does with it — serving on an ephemeral port: `GET /health` → **200 `{"ok":true}`** and `GET /prices` → **10 rows** (values agreeing with the local server, which is still answering on 3000). `T-3.2 CHECK PASSED`, exit 0. `vercel.json` was parsed rather than eyeballed → `{"rewrites":[{"source":"/(.*)","destination":"/api"}]}`. **Not done, and deliberately:** the `Do` step's "running the build/install from `backend/`" is not expressed in `vercel.json` — Vercel has no per-file way to set the root, it is the project's **Root Directory**, which T-3.3's own `Do` step 1 performs when it creates the project from `backend/`. The backend needs no build step at all (plain Node ESM, `api/index.js` is the only entry), so adding `buildCommand`/`installCommand` here would be configuration with nothing to configure. Nothing in this task can be proved further without the Vercel account T-3.3 needs.
- **Revised 2026-09-20 (one-deployment decision):** both files are for the **two-project fallback** only. Under T-3.3's Services project the Express app is detected inside `backend/` from `src/server.js` (it calls `app.listen()`, one of the two patterns Vercel's zero-config Express detection accepts), which makes `backend/api/index.js` a redundant second entry, and `backend/vercel.json` **actively harmful**: a service's own rewrites run on every request that reaches it, so its `/(.*)` → `/api` rule would rewrite `/health` away before the app saw it. Delete `backend/vercel.json` when deploying via Services; keep `backend/api/index.js` as the fallback's entry.
- **Blocks:** `T-3.3`

### [x] T-3.3 — Deploy both apps as one Vercel project, with its environment variables

- **Depends on:** `T-3.1`, `T-3.2`, `T-0.8`, `T-2.9`
- **Size:** `M`
- **Why:** §3.4.1 — "configure all secure environment variables (Supabase keys and Shopify store credentials/tokens)". **Revised 2026-09-20 (owner decision):** the requirement is **one Vercel deployment containing both apps**, so the project is created from the **repository root** and declares both as **Services** — a supported Vercel feature (`vercel.com/docs/services`: *"a Next.js frontend and a FastAPI backend in the same repository deploy together with shared routing, environment variables, and a unique domain"*). The original reading (a project created from `backend/`) is now the fallback, kept below.
- **Do:**
  1. If the dashboard asks, enable **Services** for the account — the docs mark it *Services (Beta)*, which is the one thing that cannot be checked from this repo.
  2. Create the Vercel project from the **repository root**, so the root `vercel.json` is read and both services are built (`frontend/` and `backend/` each keep their own root and install).
  3. Add every server-side variable from the Env vars table to the **project** (shared by both services; never in the repo) — the six `PG*` names, the four `SHOPIFY_*` names and `ALLOWED_ORIGIN`. Do **not** set `NEXT_PUBLIC_API_URL` (unset makes the browser use relative paths on the one origin, per T-2.9) and do **not** set `API_URL` (the binding injects it).
  4. Deploy, then settle the two things the repo cannot decide: delete `backend/vercel.json` if `/health` 404s (see T-3.2's revision), and confirm whether the injected `API_URL` carries a trailing slash.
- **Files / artifacts:** root `vercel.json` (created 2026-09-20 — `services`, the frontend→backend binding, and the rewrites that expose `/health`, `/prices` and `/prices/*` on the one domain), Vercel project config (dashboard)
- **Done when:** the deployed project answers and can reach both Shopify stores and Supabase.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}' https://<project>.vercel.app/health` → `200`.
- **Fallback (only if Services cannot be enabled):** create the project from `backend/` and a second from `frontend/`, set `NEXT_PUBLIC_API_URL` to the backend URL, and keep `backend/vercel.json` — exactly what T-3.2 built, with T-3.4/T-3.5 read as two hosts again.
- **Evidence:** 2026-09-20 — **verified, via the Vercel CLI rather than the dashboard** (this agent has no Vercel browser session; the CLI is authenticated as `paws1234`, and `link`/`env add`/`deploy` edit the same project config the dashboard does). `Do` step 1 needed nothing: `vercel link --yes --project technicalexamnodejs` printed *"Services are configured via vercel.json."* and the account deployed the services config with no Services-Beta enablement prompt, so the one thing the task said could not be checked from the repo did not stand in the way. `Do` step 2 — project created from the **repository root** (`paws1234s-projects/technicalexamnodejs`, `.vercel/project.json` written, GitHub repo connected): the first attempt failed on the directory name (`TechnicalExamnodejs` is uppercase; project names must be lowercase), which is why `--project` is given explicitly. The CLI also appended `.env*` to the root `.gitignore` and wrote a root `.env.local`; **both were reverted** (the committed `.gitignore` already lists `.env.local`), so the tree is clean of that side effect. `Do` step 3 — all **12** server-side names pushed to Production with `vercel env add <NAME> production`, values piped straight out of `backend/.env` and never printed: the six `PG*`, the **five** `SHOPIFY_*` (*the step says four, but `SHOPIFY_API_VERSION` is one of the five `config.js` requires and is the version string the Admin API URL is built from*) and `ALLOWED_ORIGIN=https://technicalexamnodejs.vercel.app`; `vercel env ls production` lists exactly those 12, and neither `NEXT_PUBLIC_API_URL` nor `API_URL` was set. **The first deploy failed, and that failure is the finding:** every route answered `500 FUNCTION_INVOCATION_FAILED` and the runtime log named the cause — `Invalid export found in module "/var/task/backend/src/app.mjs". The default export must be a function or server. Node.js process exited with exit status: 1.` Vercel's Express builder detects an entry at `src/app.{js,cjs,mjs,…}` **before** `src/server.js` (its docs: *"create a file that imports the express package at any one of the following locations … `src/app.*` … `src/server.*`"*) and the detected file must **default-export** the app or use a port listener; T-1.7's `export const app` does neither, so the detection had picked a file that could never be a valid entry. Fixed with **one line** — `export default app` at the end of `backend/src/app.js`, the only file this task changed beyond its artifacts line and named here because it is exactly the "strictly-required export" the edit rules allow; the named export stays for `server.js` and `api/index.js`, and `check-mismatch.js` plus a local `node backend/src/server.js` were re-run green afterwards. Redeploy → `✓ Ready in 31s`, `Aliased https://technicalexamnodejs.vercel.app`. **`Verify`** → `curl -s -o /dev/null -w '%{http_code}' https://technicalexamnodejs.vercel.app/health` → **`200`**, body **`{"ok":true}`**. `Done when`'s "can reach both Shopify stores and Supabase" was proved beyond the `Verify` line rather than asserted: `/prices` → **`200`** with **10 rows** of real database data (so the six `PG*` values did land), and an **idempotent** PATCH of `SKU-008` at its *current* central price — `'{"price":"39.90"}'` → **`200`** `{"sku":"SKU-008","price":"39.90","stores":[{"store":"alpha","status":"synced","error":null},{"store":"beta","status":"synced","error":null}]}` — so the deployment minted a token for each store and wrote to both, while both `live_price`s stayed `39.90` and `has_mismatch` stayed `false`, i.e. **no store price moved** (the same idempotent-probe pattern T-2.2 and T-2.8 used; the *change* case belongs to T-4.1). **`Do` step 4's two open questions:** *(1)* `backend/vercel.json` was **kept**, because the step's own condition ("delete if `/health` 404s") did not occur — and `/health` answering `{"ok":true}` instead of a 404 out of Express is precisely the proof that its `/(.*)` → `/api` rewrite is **not** applied to the service, so T-3.2's revision note calling that file "actively harmful" does not hold for this shape: the nested file is simply not read. *(2)* The frontend→backend binding is provably injected — in the *failing* deployment the server component logged `Error: GET /prices failed: HTTP 500`, a real HTTP response where an unset base would have thrown Node's `Failed to parse URL` — but its **exact form (trailing slash or not) is unverified**: a binding is injected at runtime, `vercel inspect --logs` exposes no value for it, and it is behaviourally irrelevant because T-2.9 trims a trailing slash. Also confirmed on the same domain, which is T-3.5's own check for free: `curl https://technicalexamnodejs.vercel.app/` → **`200`** with **10 unique SKUs** and **20 `>synced<`** cells in the served HTML, so the frontend service renders live data from the same origin the API answers on. **Deliberately left uncommitted:** the one-line `app.js` fix is live in the deployment but is not committed — no task in this batch asks for a commit — so it **must be committed before any push that triggers a Git deployment**, or the project returns to the 500 (the repo is connected to Vercel, so that path is live).
- **Re-verified 2026-09-20 — FAILED, so this mark is now `[!]`.** The task's own `Verify` no longer passes: `curl -s -o /dev/null -w '%{http_code}' https://technicalexamnodejs.vercel.app/health` → **`500`** (`A server error has occurred` / `FUNCTION_INVOCATION_FAILED`), measured against the deployment the production alias currently points at (`vercel inspect technicalexamnodejs.vercel.app` → `technicalexamnodejs-fr2v7vgcy-paws1234s-projects.vercel.app`, status Ready — one of three Production deployments from the previous ten minutes). The cause was read from that deployment's runtime logs (`vercel logs https://technicalexamnodejs-fr2v7vgcy-paws1234s-projects.vercel.app`) rather than inferred from the code: `Error: Missing required environment variable(s): PORT at file:///var/task/backend/src/config.mjs:28:31 … Node.js process exited with exit status: 1`, raised on `GET /health`, on `GET /prices`, and on the dashboard's own server render (`GET /` → `Error: GET /prices failed: HTTP 500`). `Do` step 3 pushed only the names the Env vars table marks server-side, and `vercel env ls production` lists exactly twelve — the six `PG*`, the five `SHOPIFY_*` and `ALLOWED_ORIGIN` — with **no `PORT`**, whose table row reads "local only"; the `config.js` T-1.2 wrote (`port: 'PORT'`, line 22) requires it regardless. The deployed project therefore cannot load its own config and every route 500s. **Not a code regression, and not a local problem:** `curl -s -o /dev/null -w '%{http_code}' localhost:3000/health` → **`200`**, because locally `PORT` comes from `backend/.env` (`PORT=3000`, `.env.example` line 15). Two independent repairs exist and choosing between them is T-3.3's own decision, not this verification pass's: set `PORT` in the Vercel project (`vercel env add PORT production`), or stop requiring it in `config.js` (it is only a `listen` argument, and T-3.2's serverless entry never listens). Recorded rather than fixed — this run's brief was the Step-2 gate, and no batch was started.
- **Repaired 2026-09-20 (owner: "fix it first") — `[x]` again, verified on the live alias.** The repair went into `backend/src/config.js`, **not** into the Vercel variables: `PORT` is now the one **optional** name (`const OPTIONAL = new Map([['PORT', '3000']])`), excluded from the missing-name throw and given a fallback when it is unset or empty, while every other name stays a startup error. That is the root cause rather than the symptom — the Env vars table marks `PORT` "local only", and the deployed entry never calls `listen` (this deploy's own log: `✓ Build complete — Using src/app.js as the root entrypoint`), so a deployment *cannot* supply a value the app has no use for, and pushing `PORT=3000` into the project would have papered over the contract instead of fixing it. Local proof of the deployment's exact condition: `env PORT= node -e "import('./backend/src/config.js')…"` → `loaded, config.port = "3000"`, i.e. the module that used to raise `Missing required environment variable(s): PORT` now loads, and the rest of T-1.2's contract is intact — still `13 keys: port,…,shopifyApiVersion`, and `env SHOPIFY_CLIENT_SECRET= …` still exits **1** naming `SHOPIFY_CLIENT_SECRET`. `localhost:3000/health` → **`200`** unchanged. Redeployed (`vercel deploy --prod --yes` → `Ready in 33s`, aliased to `https://technicalexamnodejs.vercel.app`, deployment `technicalexamnodejs-9or9hiaqx-…`), and the alias now answers this task's `Verify`: `/health` → **`200` `{"ok":true}`**. The `Done when` clause holds too — `/prices` → **10** rows, `flagged 0`, `SKU-001 … "central_price":"22.00"` with both stores `synced` from the real database, so the deployment reaches Supabase; `/` → **`200`**; and the input gate is live on the deployed API (`PATCH {"price":"abc"}` → **`400`**). **Durable half done in parallel by the owner:** while this repair was being verified the fix was committed and pushed as `d5fa4c0 "fixed deployment port things"` (the file now matches HEAD), and that push produced a **Git-triggered** Production deployment — the production alias moved to `technicalexamnodejs-rdor0m4xt-…` (created 19:54:35) instead of the CLI-built `technicalexamnodejs-9or9hiaqx-…`, and it answers the same way: `/health` → **`200`**, `/prices` → **10** rows, `flagged 0`. So the deployment is now healthy **from committed source** and no longer depends on a local-only edit — the exact exposure the failed re-check above was about. The CLI deploy left no side effects on the tree (no `.env*` re-appended to `.gitignore`, no root `.env.local`).
- **Blocks:** `T-3.4`, `T-3.5`

### [x] T-3.4 — Verify the deployed routes

- **Depends on:** `T-3.3`
- **Size:** `S`
- **Why:** the local pass does not prove the env vars landed in the deployment.
- **Do:**
  1. Call both routes against the deployed project's one domain.
- **Files / artifacts:** none
- **Done when:** the deployed read route returns real database data.
- **Verify:** `curl -s https://<project>.vercel.app/prices | jq 'length'` → `10`; `curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -d '{"price":"abc"}' https://<project>.vercel.app/prices/SKU-001` → `400`. **Restated 2026-09-20** from `https://<backend>.vercel.app/...`: the paths are unchanged — the top-level rewrites send `/prices` to the Express service and *"the service receives the original request path"* — only the host collapses from two to one.
- **Evidence:** 2026-09-20 — **verified** against the production alias `https://technicalexamnodejs.vercel.app` (this task's `Verify` names `<project>`, and T-3.3's single Services project is the host that serves both paths). Command 1 → `length = 10`, and the first row read `{"sku":"SKU-001","central_price":"22.00","alpha":"synced","beta":"synced"}`, so the read route returns all ten SKUs with both store entries populated. Command 2 → `400`. `jq` is not installed on this host, so the length was taken by piping the same body through a one-line `node` parser — the identical assertion on the same response, not a weaker substitute; the PATCH gate is a bare `curl` status either way. The `Done when` line's "real database data" was checked rather than inferred: the ten `central_price` values returned by the **deployed** API (`SKU-001=22.00 … SKU-010=89.50`) are character-for-character what `docker run --rm --env-file backend/.env postgres:16 psql -w -t -A -c "select string_agg(sku||'='||price,' ' order by sku) from products"` returns from the cloud database, so the function is reading the same rows this repo reads and not a fixture or a cache. The rejected `abc` PATCH wrote nothing — it is refused by T-1.12's `PRICE_PATTERN` before any write.
- **Blocks:** `T-3.5`, `T-4.1`

### [x] T-3.5 — Confirm the dashboard is served by that same deployment

- **Depends on:** `T-3.3`, `T-3.1`
- **Size:** `S`
- **Why:** §3.4.2 — the dashboard must be reachable without a local server. **Revised 2026-09-20:** under T-3.3's Services project there is no second deployment to create, so this task is now the check that the *frontend* service is what serves `/`, and that the browser reaches the API on its own origin.
- **Do:**
  1. Nothing to deploy — the config landed at T-3.3. Confirm `https://<project>.vercel.app/` is the dashboard and that its PATCH goes to the same origin (i.e. `NEXT_PUBLIC_API_URL` is unset, so T-2.9 sends the browser to a relative path).
- **Files / artifacts:** none
- **Done when:** the deployed dashboard loads live data from the same domain as the API.
- **Verify:** `curl -s -o /dev/null -w '%{http_code}' https://<project>.vercel.app/` → `200`, and the page in a browser shows 10 rows with both store columns populated.
- **Evidence:** 2026-09-20 — **verified**. `Do` step 1 needed no deployment work: T-3.3's `services` config already puts the frontend on the project root, and both facts it asks to be confirmed were measured rather than assumed. Command 1 → `root=200`. The browser half was taken in a **real browser** on the deployed URL, not from the HTML alone: the page title is `Central Price Sync`, the heading and the 10-row list render `SKU-001`…`SKU-010` each with its central price and **both** store cells reading `synced` — 10 rows, 10 `Update` buttons and 20 status badges, with `SKU-001` `22.00` / `synced` / `synced` as the first row. The same 20 badges appear as 20 `>synced<` occurrences in the server-rendered HTML, so the data is arriving live from the deployed API rather than from a client-side placeholder. Cross-checked against the database: the ten rendered central prices are character-for-character the ten values T-3.4 read from the cloud `products` table.
- **Same-origin, as the `Do` step words it:** `vercel env ls production | grep -c NEXT_PUBLIC_API_URL` → **`0`**, i.e. `NEXT_PUBLIC_API_URL` is **not** set in the project, so T-2.9's browser branch falls through to `PUBLIC_API_URL = ''` and the dashboard's `fetch` goes to a path on its own origin. The only `NEXT_PUBLIC_API_URL` in the tree is the local dev value in `frontend/.env.local` (`http://localhost:3000`), which is gitignored and therefore never reaches the Vercel build. `Done when` therefore holds: the deployed dashboard loads live data from the same domain as the API.
- **Blocks:** `T-3.6`, `T-4.1`

### [x] T-3.6 — Confirm the CORS stance for a single-origin deployment

- **Depends on:** `T-3.5`
- **Size:** `S`
- **Why:** §3.2.1 names CORS explicitly. **Revised 2026-09-20:** with both apps in one deployment the browser calls the API on its own origin, so no CORS headers are involved and none are exercised. The middleware stays — it is still what local dev (two ports) and the two-project fallback rely on — but this task can no longer demonstrate a cross-origin rejection on the deployed path, and the evidence must say so instead of appearing to prove more.
- **Do:**
  1. Set `ALLOWED_ORIGIN` to the deployed URL in the project and redeploy, then confirm the deployed dashboard updates a row with nothing CORS-related in the console.
- **Files / artifacts:** Vercel env var (dashboard) — the app already reads `config.allowedOrigin` from T-1.7
- **Done when:** the same-origin deployment is explained rather than assumed, and local/dev CORS still works.
- **Verify:** the deployed dashboard updates a row without a CORS error; `curl -s -D- -o /dev/null -H 'Origin: https://example.com' https://<project>.vercel.app/prices | grep -i access-control-allow-origin` → no matching header (still true, but now trivially so — the request is same-origin, which is weaker evidence than the original wording implied). **Corrected 2026-09-20 after running it:** the second command does print a header. The expectation the original wording encodes (that a foreign caller gets nothing back) only holds for `cors({ origin: '*' })`-style configurations; with the **string** origin this app uses, the middleware sends `access-control-allow-origin: <the configured origin>` on *every* response, so the check that discriminates is whether the echoed value is the **caller's** origin — it never is. Measured behaviour is in Evidence.
- **Evidence:** 2026-09-20 — **verified**; the deviation from the `Verify` line's prediction is recorded above and below rather than smoothed over. `Do` step 1 needed no redeploy: `ALLOWED_ORIGIN` is already the deployed URL in the project (set at T-3.3, visible as one of the 12 Production names; the CLI hides the value, and T-3.3's evidence records it as `https://technicalexamnodejs.vercel.app`). **Dashboard half, in a real browser on the deployed URL:** `SKU-001`'s row was re-submitted at its current price `22.00` — deliberately the **same** value, so this task proves the request path without moving a live store price — and the browser's own listener recorded exactly `REQ PATCH https://technicalexamnodejs.vercel.app/prices/SKU-001` → `RES 200`, i.e. **same origin as the page**, with the row re-rendering `22.00 | synced | synced`. Console capture returned **zero** messages and **zero** `pageerror` events: nothing CORS-related, and nothing else either. One unrelated event appeared in the browser's own log during the interaction — an aborted Next.js RSC prefetch (`GET /?_rsc=…` → `net::ERR_ABORTED`) — which is the client router re-requesting after T-2.6's refresh, not a CORS failure (a CORS refusal reads `blocked by CORS policy`), and the row it renders is correct. **Cross-origin half:** `curl -s -D- -o /dev/null -H 'Origin: https://example.com' https://technicalexamnodejs.vercel.app/prices` → the response carries `access-control-allow-origin: https://technicalexamnodejs.vercel.app`, **not** `*` and **not** the caller's `https://example.com`. So a browser on `example.com` fails its own CORS check (a mismatch between the request origin and the echoed value is a denial), which is what the task is asking to be true; the shape just differs from the literal `grep` the `Verify` line predicted. **Local/dev CORS still works, which is the other half of `Done when`:** against the local backend, `curl -s -D- -o /dev/null -H 'Origin: http://localhost:3001' localhost:3000/prices` → `Access-Control-Allow-Origin: http://localhost:3001` (`local-health=200`), so the middleware is still the thing serving Phase 2's two-port dev setup. No code was changed by this task — the observed behaviour is the `cors` package's standard string-origin handling, and narrowing it to satisfy the mis-written grep would have been a change with no security benefit.
- **Blocks:** `T-4.1`

### [x] T-3.7 — Write the README

- **Depends on:** `T-3.4`, `T-3.5`
- **Size:** `M`
- **Why:** the deliverable is an interview assignment; a reviewer needs the architecture, the env var list, and the run/deploy steps without reading the code.
- **Do:**
  1. Add a root `README.md` covering the architecture (Supabase ← Express → two Shopify stores, Next.js on top), the Env vars table, local run steps, the deployed URLs, and the known simplifications from Open questions.
- **Files / artifacts:** `README.md`
- **Done when:** a reader can run both apps and understand the sync flow from the README alone.
- **Verify:** the README lists every variable in the Env vars table (`grep -c` matches) and the deployed URL resolves — **one** URL since T-3.3's revision, with the `services` config and the binding explained rather than left as magic.
- **Evidence:** 2026-09-20 — **verified**; `README.md` already existed and covered the Docker/CLI dev loop well, so this was an edit rather than a rewrite (the stale claim that the two services "exit immediately … the app code … does not exist yet" was removed, and the architected sections added). **Variable half:** the 17 names of the Env vars table were extracted from this file (`grep -oE '^\| `[A-Z_]+`' task.md | sed … | sort -u` → 17) and each was looked up in `README.md` → every one found, **`MISSING=0`**, the lowest counts being 1 (`SHOPIFY_ALPHA_STORE` … `PGSSLMODE`, `SUPABASE_*`). The new `## Environment variables` section carries the same four columns as the table here, so a reviewer does not need `task.md` to know what to set. **URL half:** `grep -oE 'https://[a-z0-9.-]*vercel\.app' README.md | sort -u` → exactly **one** URL, `https://technicalexamnodejs.vercel.app`, and it `resolves=200`. The `services` config and the binding are stated rather than left as magic: the README explains that the two apps are two Services in one project, why a service receives the original path (so the Express routes need no prefix), and quotes the binding object that makes Vercel inject `API_URL` — plus the same-origin consequence that `NEXT_PUBLIC_API_URL` stays unset. New sections beyond the `Do` list, because the `Done when` line asks a reader to understand the sync flow from the README alone: a `## How it fits together` diagram with the Step A/B/C description, a `## Known simplifications` section carrying the Open-questions findings (unauthenticated PATCH, last-known rather than live store prices, `failed` vs `mismatch`, single currency, the ~102 granted scopes, and the Services-beta dependency with the two-project fallback), and npm run steps for both apps. `plan.md` was not touched.
- **Blocks:** `T-4.6`

---

## Phase 4 — End-to-end acceptance (maps to the plan's success criteria)

### [x] T-4.1 — Trigger a price update from the deployed dashboard and confirm the database reflects it

- **Depends on:** `T-3.4`, `T-3.5`, `T-3.6`
- **Size:** `S`
- **Why:** §3.4.3 first bullet and §1 — "automatically propagate price updates when changed centrally", driven from the UI.
- **Do:**
  1. On the deployed dashboard, change one SKU to a clearly new price and submit.
- **Files / artifacts:** none
- **Done when:** the request succeeds and the central price is persisted.
- **Verify:** the UI shows the new price after T-2.6's refresh; `docker run --rm --env-file backend/.env postgres:16 psql -w -t -A -c "select price from products where sku='<SKU>'"` → the new value.
- **Evidence:** 2026-09-20 — **verified**, driven from the **real browser on the deployed dashboard** (`https://technicalexamnodejs.vercel.app/`), not by calling the API directly. SKU chosen: `SKU-005` ("Ceramic Pour-Over Set"), the one SKU no earlier task had moved, so `45.00 → 47.50` is unambiguous. **Before:** psql read `SKU-005|45.00` and the deployed `/prices` row was `central_price 45.00`, both stores `synced` at `45.00`, `has_mismatch false`. **`Do` step 1 in the UI:** typed `47.50` into that row's price input and pressed its `Update` button — the page issued `REQ PATCH https://technicalexamnodejs.vercel.app/prices/SKU-005` → `RES 200`, so the request is the dashboard's own and it succeeded. **`Verify` first half:** the row's **central cell** (read as `children[1]`, so the typed input value cannot masquerade as the refreshed one) read `Central45.00` before and `Central47.50` **3.5s** after the submit, which is T-2.6's refresh landing — the two store cells stayed `synced`. Console capture during the whole interaction: **zero** messages. **`Verify` second half, an independent read rather than the API's own answer:** `select sku, price, updated_at from products where sku='SKU-005'` → `SKU-005|47.50|2026-09-20 12:02:55.015172+00`, i.e. the new value **persisted** with a fresh `updated_at`. The propagation is visible in the same read: `store_sync_status` holds `alpha | synced | 47.50` and `beta | synced | 47.50`, and the deployed `/prices` row reads `central_price 47.50`, both stores `synced`, `has_mismatch false`. **Data consequence for every task after this one:** `SKU-005` is no longer `45.00` — the seed value in `backend/seed/products.json` no longer describes the live row, so anything quoting the seed for `SKU-005` must re-read it.
- **Blocks:** `T-4.2`, `T-4.6`

### [x] T-4.2 — Confirm both Shopify admin panels show the new price

- **Depends on:** `T-4.1`
- **Size:** `S`
- **Why:** §3.4.3 second bullet — the plan's success criterion is that *both* stores received the update, not just the API call returning 2xx.
- **Do:**
  1. Open the variant for the updated SKU in Store Alpha and Store Beta.
- **Files / artifacts:** none
- **Done when:** both admins show the new value for that SKU.
- **Verify:** Alpha and Beta admin → that variant's price equals the T-4.1 value (named UI observation, both stores); independently `findVariantBySku` returns the same price for both.
- **Evidence:** 2026-09-20 — **verified, with this `Verify`'s two halves held to different standards and labelled as such.** The admin half was performed by the owner, not by this agent: asked to open the `SKU-005` variant (*Ceramic Pour-Over Set*) in both panels and confirm the price, the owner answered *"yes its 47.50"*. No agent-side admin observation was possible, and that limitation is **measured rather than assumed** — `https://admin.shopify.com/store/alphastore-sdgba8qx/products` opened in the agent's browser lands on `accounts.shopify.com/lookup` (Shopify's log-in wall), and signing in would mean handling the owner's credentials. The second half — "independently `findVariantBySku` returns the same price for both" — was measured here, and it is the substantive one: `alpha alphastore-sdgba8qx.myshopify.com {"variantId":"gid://shopify/ProductVariant/50472598372602",…,"price":"47.50"}` and `beta betastore-haewq5ha.myshopify.com {"variantId":"gid://shopify/ProductVariant/46218660872291",…,"price":"47.50"}`, equal to `products.price` `SKU-005=47.50` read in the same pass — so both stores genuinely hold the T-4.1 value, which is what the `Done when` line asserts; the admin panel only displays it. A second path agrees in the same run: `node backend/scripts/refresh-status.js` re-read both stores through the app credential and reported `20 rows in store_sync_status for 10 SKUs × 2 stores, 0 failed`, so no store held anything but its central price. **Attribution caveat, stated rather than smoothed:** the owner's confirmation is one report, asked in terms of both admins, not two separately-worded observations, so "each panel displayed it" rests on a single statement — while the store-level fact both halves test is proven independently of the admin UI, which is why this is recorded verified rather than left open.
- **Blocks:** `T-4.6`

### [x] T-4.3 — Confirm the read endpoint reports no mismatch for both stores

- **Depends on:** `T-4.1`, `T-1.17`
- **Size:** `S`
- **Why:** §1/§3.2.3 — the visibility criterion: after a successful sync, nothing should be flagged.
- **Do:**
  1. Run the baseline refresh for the updated SKU (or a full refresh) and read the endpoint.
- **Files / artifacts:** none
- **Done when:** the updated SKU reports both stores `synced`.
- **Verify:** `curl -s https://<project>.vercel.app/prices | jq '.[] | select(.sku=="<SKU>") | {central_price, statuses: [.stores.alpha.status, .stores.beta.status], has_mismatch}'` → both `synced`, `has_mismatch: false`. **Restated 2026-09-20** (T-3.3 revision): one host, same path.
- **Evidence:** 2026-09-20 — **verified**, and the refresh does more work here than the `Verify` line implies. `Do` step 1's baseline refresh ran against the **live stores**: `node backend/scripts/refresh-status.js` → `20 rows in store_sync_status for 10 SKUs × 2 stores, 0 failed`, **exit 0**. That matters for a reason worth stating: the script *re-reads each store's real price through Shopify* and only then decides `synced` vs `mismatch`, so `0 failed` is an independent confirmation that **both stores genuinely hold `SKU-005`'s `47.50`** — it is not the PATCH's own claim read back, and it is the strongest available substitute for T-4.2's admin-panel observation. `Verify` on the deployed endpoint, filtered to the SKU T-4.1 moved → `{"central_price":"47.50","statuses":["synced","synced"],"has_mismatch":false}`, i.e. both stores `synced` and nothing flagged — and the whole board agrees: `flagged across all 10 SKUs = 0`. `jq` is not installed here, so the same `select`/projection was done with a one-line `node` parser over the identical response body.
- **Blocks:** `T-4.6`

### [x] T-4.4 — Deliberate failure case — one store fails, the other still syncs

- **Depends on:** `T-4.1`
- **Size:** `M`
- **Why:** §3.4.3 last bullet — "check that mismatches or errors are properly flagged if a simulated network or authentication failure occurs".
- **Do:**
  1. Break one store's credential only (point `SHOPIFY_BETA_STORE` at a non-existent store in the backend env) and update a SKU from the dashboard.
  2. Restore the credential after recording the result.
- **Files / artifacts:** Vercel env var (dashboard) — no code change
- **Done when:** the failure is isolated and visible, and the central price is still recorded.
- **Verify:** Alpha's admin shows the new price; Beta is unchanged; the dashboard shows Beta `failed`/red and Alpha `synced`/green; `products.price` holds the new value. Observed in the UI *and* via `/prices` and the `store_sync_status` rows.
- **Evidence:** 2026-09-20 — **verified**, on the **deployed** backend (the `Files` line says Vercel env var, so the break was put where the demo runs, not in local `backend/.env`). `Do` step 1 without touching code or the dashboard UI: `vercel env rm SHOPIFY_BETA_STORE production --yes` → `vercel env add SHOPIFY_BETA_STORE` fed the bogus `betastore-does-not-exist-9f3a.myshopify.com` on stdin → `vercel deploy --prod --yes` (`Ready in 23s`, aliased), because a Vercel env var only reaches a function in a **new** deployment. SKU chosen: `SKU-006` (`36.75 → 41.00`), the second SKU untouched by earlier tasks. **Pre-state, so "Beta is unchanged" is measurable:** `products.price` `36.75`, both `store_sync_status` rows `synced | 36.75`, and each store read **live** through the Admin API (`findVariantBySku` with the real domains) → `alpha 36.75`, `beta 36.75`. **The failure, from the dashboard:** submit `41.00` in the browser on the deployed URL → `REQ PATCH …/prices/SKU-006` → `RES 200` with body `{"sku":"SKU-006","price":"41.00","stores":[{"store":"alpha","status":"synced","error":null},{"store":"beta","status":"failed","error":"token request for beta failed: HTTP 404 {\"errors\":\"Not Found\"}"}]}` — so the request as a whole is **not** an error, one store succeeded and the other carries its own reason (T-1.16's contract, now confirmed through the deployed path). **`Verify`, UI half:** after T-2.6's refresh the row reads central `41.00`, store A badge `synced` (computed `background-color` on the green `lab` side) and store B badge **`failed`** (`lab(92.24 …)`, the red side) whose `title` carries the full error text; T-2.7's inline message also renders (`beta: token request for beta failed: HTTP 404 …`, sampled 200ms apart — it appears with the refresh, so a single read taken too early sees no `<p>`). **`Verify`, data half — three independent reads, not the API agreeing with itself:** `products.price` → `SKU-006|41.00`, i.e. the central price was **still recorded** despite Beta's failure; `store_sync_status` → `alpha | synced | 41.00 | (no error)` and `beta | failed | (null live_price) | token request for beta failed: HTTP 404 …`; deployed `/prices` → `{"central_price":"41.00","has_mismatch":true,"alpha":"synced","beta":{"status":"failed","live_price":null}}`. **The stores themselves:** Alpha reads `41.00` from **two** independent credentials — the app's Admin API call and the CLI's own store session (`docker compose run --rm shopify store execute -s <alpha> …` → `{"sku":"SKU-006","price":"41.00"}`) — while Beta reads `36.75`, exactly its pre-state value, so **only Beta's branch was affected**. `Do` step 2 done and checked: the bogus value removed, the real one re-added from `backend/.env` (piped, never printed), `vercel env ls production` back to **12** names, redeployed (`Ready in 20s`, aliased). Beta's `live_price` is `null` rather than stale because the failure happened **before** the lookup, which is the `failed` branch T-1.15 defined (a failure after the lookup records `mismatch` with the stale price).
- **Blocks:** `T-4.5`, `T-4.6`

### [x] T-4.5 — Recovery — restoring the credential returns the store to `synced`

- **Depends on:** `T-4.4`
- **Size:** `S`
- **Why:** the mismatch state must be recoverable, otherwise the "single source of truth" claim only holds until the first error.
- **Do:**
  1. Restore `SHOPIFY_BETA_STORE`, re-submit the same SKU (or run the refresh script), and re-read the status.
- **Files / artifacts:** none
- **Done when:** Beta's price matches central again and its status clears.
- **Verify:** Beta admin shows the central price; `/prices` reports Beta `synced` with `has_mismatch: false` for that SKU.
- **Evidence:** 2026-09-20 — **verified**. `Do` step 1's credential restore was the closing half of T-4.4 (real value re-added to the Vercel project from `backend/.env`, 12 names, redeployed), so this task's own work is the re-submit and the read-back. **Re-submit from the dashboard, same SKU and same price** (`SKU-006` at `41.00`, which is the central price T-4.4 left behind — the recovery is "does Beta now take the price it refused", not a new price), in the deployed browser: the row's badges were `[synced, failed]` **before** the submit and `[synced, synced]` after, both on the green `lab(96.19 …)` background with `title` null, and the PATCH body came back `{"sku":"SKU-006","price":"41.00","stores":[{"store":"alpha","status":"synced","error":null},{"store":"beta","status":"synced","error":null}]}` with **no** inline message (nothing left to report). Console capture: zero messages. **`Verify`:** the deployed `/prices` row → `{"central_price":"41.00","statuses":["synced","synced"],"has_mismatch":false}`, and the whole board is clean again — `flagged across all 10 SKUs = 0`. **The status cleared rather than being overwritten with a stale value:** `select … from products p left join store_sync_status s using (sku) where p.sku='SKU-006'` → `alpha | synced | 41.00 | 2026-09-20 12:06:33.613727+00 | (no error)` and `beta | synced | 41.00 | 2026-09-20 12:06:34.377178+00 | (no error)`, i.e. Beta's `error` text from T-4.4 is gone and `live_price` moved from `null` to `41.00`. `Done when` holds at the store itself, not just in the log: Beta read live through the Admin API (real domain, app credential) → `beta live price = 41.00`, equal to central, with Alpha at the same value. The failed→synced transition therefore round-trips, which is the claim T-4.4 could not make on its own.
- **Blocks:** `T-4.6`

### [x] T-4.6 — Rehearsal — one clean run-through of the whole demo

- **Depends on:** `T-4.1`, `T-4.2`, `T-4.3`, `T-4.4`, `T-4.5`, `T-3.7`
- **Size:** `M`
- **Why:** this is an evaluation; the sequence (dashboard → database → both stores → flagging) has to run without improvising.
- **Do:**
  1. From a clean state, run the full sequence once, timing it: show the dashboard, update a SKU, show both Shopify admins, show `/prices`, then trigger the failure case and the recovery.
  2. Note anything that needed an unplanned step.
- **Files / artifacts:** none (optionally a scripted checklist section in `README.md`)
- **Done when:** the sequence completes unaided, with the failure case and recovery both demonstrated.
- **Verify:** the run covers success, mismatch flagging, and recovery within the demo time box; every value shown matches what the API and the admins report (named observation across dashboard, Supabase, and both stores).
- **Evidence:** 2026-09-20 — **verified.** The sequence ran end to end on the **deployed** system today, in three phases, with this line labelling who observed what. **Success:** the owner ran the dashboard half — `SKU-009` (*Linen Apron*) changed from `52.00` to `54.25` and submitted; the database timestamps the sync (`store_sync_status … 12:46:13.958` and `12:46:14.760`) and both stores read back `54.25`, so the change is real rather than a UI echo. **Mismatch flagging:** injected by the agent, the only party that reaches the Vercel CLI — Beta's credential pointed at a non-existent store plus `vercel deploy --prod --yes` (12 names), then the same row submitted again **at the price it already held**, so no live price moved: the response was `200` with `alpha synced` / `beta failed … HTTP 404 …`, the UI showed Store A green and Store B **red `failed`** (`lab(92.24 10.29 …)` against the green `lab(96.19 -13.85 …)`) carrying the error in its `title` and T-2.7's inline `beta: …` message, `/prices` flagged **1** with `has_mismatch true`, and `products.price` still read `SKU-009=54.25` — the central write survived a store failure. **Recovery:** credential restored, redeployed, the same row re-submitted → `200` both `synced`, badges back to green with no message, `/prices` flagged **0**, and `node backend/scripts/refresh-status.js` re-read both stores through Shopify to report `20 rows … 0 failed`, so the recovery is the stores' own answer rather than the API's claim read back. **Substitution, stated rather than glossed:** the `Verify` asks for a named observation "across dashboard, Supabase, and both stores", and no party looked at the Shopify admin panels during the ~25s failure window — that window is deliberately transient and cannot be revisited after the fact. The nearest live proof was taken instead, and for this particular claim it is stronger: both stores were read **directly** through the Admin API — Beta `54.25` **while the deployment reported it failed**, proving the failed store was genuinely left untouched, and both `54.25` after recovery. Alpha also has the CLI's independent store session; Beta still has no second credential path (the T-0.5 caveat), so its read rests on the app credential alone. **Timing and unplanned steps:** the three phases spanned `12:46 → 12:48 → 12:49`, roughly three minutes of wall clock including both redeploys, inside any demo time box. The only unplanned steps were operator-side rather than product-side: the failure case needs the Vercel CLI instead of the dashboard, and T-2.7's message appears only **with** the refresh (~3s), so a read taken the instant the button is clicked misses it. One benign console event recurs throughout — `?_rsc=… net::ERR_ABORTED`, Next.js's own prefetch after `router.refresh()` — and is not a failure. **End state:** 20 `store_sync_status` rows `synced`, `/prices` flagged `0`, `SKU-009` `54.25` in the central table and in both stores.
- **Blocks:** none

---

## Phase 5 — Product images (added 2026-09-20, after Phase 4)

Requested after the price sync was complete: every product in both stores carries an image that
fits its name, taken free from the internet, held in Supabase, and pushed to the stores from there.
No new environment variable is involved — the image provider needs no API key, so the deployed
backend is unaffected and `backend/.env` gained nothing.

### [x] T-5.1 — Hold one image per product in Supabase, searched by the product's own name

- **Depends on:** `T-0.11`, `T-0.13`
- **Size:** `M`
- **Why:** the request was for images from the internet that *fit* the product and come from Supabase, so the bytes have to be stored and the choice has to be justifiable.
- **Do:**
  1. Add a `product_images` table: the bytes, one row per SKU, with the provenance that makes a free image publishable (provider, search term, source page, licence, creator, hash).
  2. Add `backend/src/images.js`: search by the derived term, download, store.
- **Files / artifacts:** `backend/seed/schema.sql`, `backend/src/images.js`
- **Done when:** re-running the fetch adds nothing (it reads the row back), and every row names the licence and creator of the image it holds.
- **Verify:** `select count(*) from product_images` = 10 and the query prints a licence and creator for each; a second run of the fetch returns the stored rows without searching again.
- **Evidence:** 2026-09-20 — **verified.** Schema applied over the pooler (`psql -f /seed/schema.sql` → `CREATE TABLE` for `product_images`, plus `ALTER TABLE` for the `source_title` column added once the first picks turned out to be unauditable). 10 rows / **2563 kB** total; every row carries a licence (`by`, `by-sa`, `cc0`, `pdm`) and a creator, e.g. `SKU-001` *Travel mug* by Brugo (by 3.0), `SKU-005` *Coffee dripper* by iyoupapa (by-sa 2.0), `SKU-008` *Polar Bottle® Insulated Bottles* by Tikboodle (by-sa 3.0). Provider is Openverse — keyless, and its `license` filter is the point of using it: only `cc0,pdm,by,by-sa` are requested, so nothing that forbids commercial use or modification can be stored. The fetch is idempotent by primary key: `ensureImage` returns the existing row, so re-running searches nothing (`on conflict do nothing` covers the racy case). Costs measured rather than assumed: an anonymous Openverse client is limited to **20 requests/minute and 200/day** (`x-ratelimit-*` headers), which is why the bytes are persisted rather than re-derived, and a 15-request probe ran without a `429`. **The relevance work was the real cost, and the first attempt failed it:** the derived term for *Ceramic Pour-Over Set* was `Pour-Over Set`, whose word `set` matched **Sunset** as a substring — a NASA satellite photograph of Alaska was stored for a coffee set; *Aero Travel Mug* matched a photograph of a camera lens titled "Canon Zoom Lens EF 70-200mm f/4 L USM Travel Mug"; *Field Notebook* matched a man reading. Fixes, each asserted in the self-check: whole-word matching (so `set` cannot match `Sunset`), trailing generic nouns dropped from the term (`Set`, `Kit`, `Pack`), artwork/diagram/scan tags excluded (the Met's engraving "Design Gothic Desk Tray" and NASA's labelled maps arrive that way), a singular form searched alongside the plural ("Geometric Felt Coaster DIY" only appears for `felt coaster`), and a rank of title mention above tag-only mention with the shortest title winning — a photo titled *Travel mug* beats one titled *… USM Travel Mug*, and a title mention beats a result whose tags alone agree. That last rank was itself buggy first time: the flag reused the membership predicate, so the two were always equal and the sort silently degenerated to "shortest title overall", which is how *please give me water* (17 characters, tagged as an insulated bottle) won. A **curated phrase map** in `backend/scripts/sync-images.js` covers the four names the keyless index has no photograph of under any derived term (`paper notebook` — "notebook" alone is a laptop; `coffee dripper`; `drink coaster` — "Coasters" is roller coasters; `reading lamp` — "desk lamp" returned a blurry 29 kB shot), and a phrase cannot smuggle in a wrong picture because the chosen photo still has to mention it. The result was judged by looking at all ten images rather than by their titles: nine depict the object (travel tumbler, notebook, crew socks, canvas tote, pour-over drippers, decorative coaster, insulated sport bottles, apron, task lamp) and `SKU-006` shows a desk with a pull-out tray, which fits *Bamboo Desk Tray* loosely. The residual limit is the source, not the code — a keyless CC index has no product-photography intent — and it is recorded in the README's simplifications.
- **Blocks:** `T-5.2`

### [x] T-5.2 — Upload the stored image to both stores

- **Depends on:** `T-5.1`
- **Size:** `M`
- **Why:** the request ends in "sync it" — the image has to reach both stores, from the Supabase copy.
- **Do:**
  1. Add the media read and the upload to `backend/src/shopify.js`.
  2. Add `backend/scripts/sync-images.js`: ensure the image exists, then attach it to both stores' product, skipping any store that already holds it.
- **Files / artifacts:** `backend/src/shopify.js`, `backend/scripts/sync-images.js`
- **Done when:** every SKU has a `READY` image in both stores, and a second run uploads nothing.
- **Verify:** the script reports 20/20 store/SKU pairs `READY` and `0 failed`; an immediate re-run reports every pair `already READY`.
- **Evidence:** 2026-09-20 — **verified.** First run `10 images in product_images for 10 SKUs; 20/20 store/SKU pairs now hold the image, 0 failed`; an immediate re-run `20/20 … already READY`, `0 failed`, with no upload attempted — the idempotence is the stores' state being read back, not the script's optimism. **The API surface had changed under the documentation:** `productCreateMedia` **does not exist** in API version 2026-07 (introspecting `Mutation` was the only way to see it), and its replacement is the `media` argument of `productUpdate` — which additionally rejects an identifier-only call with `INVALID_FIELD_ARGUMENTS: productUpdate must include exactly one of the following arguments: input, product`, so the mutation has to name the product as `product: { id: $productId }`. Since the bytes are ours and not a public URL, the route is a **staged upload**: `stagedUploadsCreate` → `POST` the file to the returned target with its signed parameters (Node's `FormData`/`Blob`, no manual `Content-Type` or the boundary breaks) → `productUpdate(media: [{ originalSource: resourceUrl, alt, mediaContentType: IMAGE }])`. `alt` is the product name, which is also the key the skip check matches on. **Processing is asynchronous** — the mutation returns while the media is still `UPLOADED`/`PROCESSING` — so `waitForMedia` polls `Product.media` until `READY` and treats `FAILED` as a failure; without it the sync would have reported success for images the store had not published. One transient failure was observed and is recorded rather than smoothed over: the first attempt at a re-upload for `SKU-006` failed once, its message lost to a `tail` that cut it, and the retry landed cleanly on both stores. Removing an image for replacement needs `fileDelete` (`productDeleteMedia` is gone too); it deleted the file and left the product with 0 media, which is how `SKU-006`'s mislabelled `.jpg` (WebP content) and `SKU-010`'s blurry shot were replaced — the filename extension now comes from the stored content type. Prices were untouched: `refresh-status.js` still reports `20 rows in store_sync_status … 0 failed` on both stores.
- **Blocks:** `T-5.3`

### [x] T-5.3 — Verify the stores hold the image that Supabase holds

- **Depends on:** `T-5.2`
- **Size:** `S`
- **Why:** "make sure it synced" is the request's own acceptance criterion, and an upload that was accepted is not an image that was published.
- **Do:** read each store's media back and compare it with the stored row.
- **Files / artifacts:** none (throwaway driver in `/tmp`)
- **Done when:** both stores report a `READY` image per SKU that matches the row it came from.
- **Verify:** an independent read reports 20/20 `READY` with the uploaded size equal to the stored size and the dimensions decoding back to the stored image's dimensions.
- **Evidence:** 2026-09-20 — **verified.** `10 Supabase images x 2 stores; 0 problems`, exit `0`, per pair: `READY 683x1024 uploaded=51935B (stored 51935B) … same-as-other-store`, with the store's filename (`aero-travel-mug.jpg`, `bamboo-desk-tray.webp`) matching the product name. Byte-identical comparison was tried first and **is not achievable**: Shopify re-encodes on ingest, so the bytes at the CDN URL differ from the uploaded file (51 kB/`76a8aae524` → 50 kB/`536d9847e2`, same 683x1024) and a hash check reported 20 false failures — the check was wrong, not the sync. Provenance is proved by two things Shopify itself reports: `MediaImage.originalSource.fileSize` equals the Supabase row's byte length **exactly** for all 20 pairs, and the store's `image.width/height` decode back to the same dimensions as the stored bytes (the driver reads JPEG/PNG/WebP headers to check this, which is how the WebP row was caught at all). Both stores serving the **same** re-encoded hash per SKU rules out one store receiving different bytes. Third path, independent of the app's credentials: the Shopify CLI's own store session reports `mediaCount { count }` = 1 for all ten Alpha products. End state: 10 `product_images` rows, 20/20 `READY`, `/prices` still flagged `0`.
- **Blocks:** none

---

## Phase 6 — Images and product details in the dashboard (added 2026-09-22)

Requested after the walkthrough: each product's image should appear in the dashboard next to its SKU
and before the item name, and the SKU, the item name and the image should be editable from there and
kept in step with both stores. Two new frontend components (`ProductImage`, `ProductEditor`) and two
new routes (`GET`/`PUT /images/:sku`, `PATCH /products/:sku`); `GET /prices` now reports each row's
image hash. No new environment variable: the upload is a raw request body, so no multipart parser
and no storage bucket were introduced — the bytes go to the same `product_images` table Phase 5
filled.

### [x] T-6.1 — Serve the stored image and show it in the row

- **Depends on:** `T-5.1`, `T-2.3`
- **Size:** `S`
- **Why:** the image already existed in Supabase but was only visible in the Shopify admin; the request puts it in the dashboard, before the item name.
- **Do:**
  1. `GET /images/:sku` returns the row's bytes with its content type, and the row's hash as the `ETag` so a replaced image is never served from a stale cache.
  2. `GET /prices` reports `image: { sha256, bytes } | null` per row, so the table knows whether to render a thumbnail or a placeholder and can cache-bust with the hash.
  3. `ProductImage` renders it, first in the product cell, and the row template gains the extra column.
- **Files / artifacts:** `backend/src/app.js`, `backend/src/queries.js`, `frontend/components/ProductImage.tsx`, `frontend/app/page.tsx`
- **Done when:** every row shows its stored image before the SKU and the item name, and a request for an image the database does not hold answers `404` rather than a broken image.
- **Verify:** `GET /images/SKU-001` returns the stored bytes and an `ETag` equal to `product_images.sha256`; the same request with `If-None-Match` answers `304`; the dashboard's first cell child is the `<img>`, followed by the SKU and then the name; `GET /images/NOPE` → `404`.
- **Evidence:** 2026-09-22 — **verified.** `GET /images/SKU-001` → `200`, `315677` bytes, `file` decodes it as an 816x1524 JPEG, `ETag: "95cc8965…ace6ed"` which is the row's `sha256`, and the `If-None-Match` replay → **`304`, 0 bytes**. `GET /images/NOPE` → `404 {"error":"no image for sku: NOPE"}`. `/prices` → `10` rows, `10` with `image`, row 1 `{"sha256":"95cc8965…","bytes":315677}`. In the browser (Playwright, after a reload — see the stale-render note in T-6.2): `10` `<img>` elements, the first cell's children read `[img, div(sku+name)]`, the thumbnail measures `40x40` with `naturalWidth/naturalHeight` `816x1524 complete=true`, and its `src` carries `?v=<sha>`. Layout was re-measured at 375 / 768 / 1280 / 1440: `scrollWidth ≤ viewport` and **0** elements extending past the viewport at every width. **One layout change was forced by the extra column:** the aligned-table breakpoint moved from `md` (768) to `lg` (1024) and the container from `max-w-4xl` to `max-w-5xl`, because at 768 the eight columns squeezed "Aero Travel Mug" onto three lines; at 1280 every item name now renders on one line in a 268px column.
- **Blocks:** `T-6.2`, `T-6.3`

### [x] T-6.2 — Edit the SKU and the item name, and push both to the stores

- **Depends on:** `T-6.1`
- **Size:** `M`
- **Why:** a SKU is both the catalogue's primary key and the key every store lookup searches by, so a rename that stops at Supabase breaks the next price sync.
- **Do:**
  1. `PATCH /products/:sku` with a new `sku` and/or `name`: validate, update the catalogue row, then rename the variant's SKU and write the product title on both stores, reporting each store's result.
  2. Let a rename follow into the child tables by giving both foreign keys `on update cascade` — in `seed/schema.sql` for a fresh database and as a re-runnable `alter table` for the existing one.
  3. `ProductEditor` (a disclosure per row) for the two fields, and `productVariantsBulkUpdate`/`productUpdate` calls behind it.
- **Files / artifacts:** `backend/src/app.js`, `backend/src/queries.js`, `backend/src/shopify.js`, `backend/seed/schema.sql`, `frontend/components/ProductEditor.tsx`, `frontend/lib/api.ts`
- **Done when:** a rename moves the catalogue row, the sync log and the stored image together, both stores answer to the new SKU, and a price update still works afterwards.
- **Verify:** rename a SKU and rename it back; after each step `products`, `store_sync_status` and `product_images` report the new SKU only, both stores resolve `sku:<new>` and no longer resolve the old one, and a `PATCH /prices/:sku` at the current price still reports both stores `synced`. Bad input: no field → `400`, empty name → `400`, malformed SKU → `400`, unknown SKU → `404`, a SKU in use → `409`.
- **Evidence:** 2026-09-22 — **verified** on `SKU-010` (*Brass Desk Lamp*) renamed to `SKU-010T` and back. `PATCH /products/SKU-010 {"sku":"SKU-010T","name":"Brass Desk Lamp (rename test)"}` → `200` with both stores `synced`; the read-back showed `products` = `SKU-010T | Brass Desk Lamp (rename test) | 89.51`, **both** `store_sync_status` rows moved to `SKU-010T`, and `product_images` moved with the **same** `sha256`/`92090B` — the image was not re-uploaded. An independent Admin API read (its own token mint and query, not the app's) reported `alpha: matches=1 | sku=SKU-010T price=89.51 title="Brass Desk Lamp (rename test)"` and the same on `beta`, while `sku:SKU-010` returned `matches=0` on both. The rename back produced the identical picture, `/prices` showed `SKU-010` `alpha synced / beta synced`, and an idempotent `PATCH /prices/SKU-010` at its own `89.51` → `200` both `synced`, so a renamed SKU is still price-syncable. Refusals measured: `{}` → `400 "send a new name and/or sku"`, `{"name":""}` → `400`, `{"sku":"has space"}` → `400`, `PATCH /products/NOPE` → `404`, `{"sku":"SKU-002"}` from `SKU-001` → `409 "sku already in use: SKU-002"`. **Trap found and fixed on the way:** the first `{"sku":"x"}` attempt returned **`500`**, and the psql check said why — the live database still had the original `no action` foreign keys, so `create table if not exists` in `schema.sql` had never applied the new clause. Running `psql -f /seed/schema.sql` over the pooler (`ALTER TABLE` ×4) turned both constraints into `update=c delete=c` and the rename worked; the route now also logs 5xx (`GET/PATCH …: <error>`) because the handler's generic message had hidden a database error behind "Internal server error". The browser path was proved separately: a name edit submitted from the dashboard's editor (`requestSubmit`, sampled every 250ms) showed `Saving…` → the green `alpha synced · beta synced` after ~2.6s, and both stores then read `title="Field Notebook A5 (ui test)"`. **Rendering note:** the first Playwright read of the dashboard was a **stale render** from an earlier session (the price editor showed `22.00` while the table showed `300.00` and no thumbnail); the server-rendered HTML was correct all along, and re-navigating fixed it — same class of trap as the cached-env note in T-2.2.
- **Blocks:** `T-6.3`

### [x] T-6.3 — Replace the image from the dashboard

- **Depends on:** `T-6.1`, `T-6.2`
- **Size:** `M`
- **Why:** the image was fetch-once, never replaceable; the request makes it a field the dashboard can change.
- **Do:**
  1. `PUT /images/:sku` with the file as the raw request body (`express.raw`, no multipart dependency): identify the type from the magic bytes, upsert the row with its new hash, then on each store delete the media the product already holds and upload the new bytes with the current name as the alt.
  2. `deleteMediaFiles` (`fileDelete`, since `productDeleteMedia` is gone) and `sniffImageType`/`imageFilename` in the image module.
  3. A file input in `ProductEditor` and `replaceImage` in `lib/api.ts`.
- **Files / artifacts:** `backend/src/app.js`, `backend/src/shopify.js`, `backend/src/images.js`, `backend/src/queries.js`, `frontend/components/ProductEditor.tsx`, `frontend/lib/api.ts`
- **Done when:** an uploaded file replaces the stored image and the store's image, leaving exactly one image per product per store.
- **Verify:** upload a different image → the row's `sha256`/length become the uploaded file's, both stores report one `READY` image whose `originalSource.fileSize` equals the uploaded length, and the dashboard shows the new bytes after the refresh; a non-image body → `400`.
- **Evidence:** 2026-09-22 — **verified**, both through the API and through the dashboard, on data that was restored afterwards. `PUT /images/SKU-001` with a different real photo (`63108B`, `500x500`) → `200` both stores `synced` with a CDN URL each; the row became `upload | uploaded | aero-travel-mug.jpg | ccd1e945… | 63108B`; `GET /images/SKU-001` served **exactly those bytes** with a matching `ETag`; and both stores reported `media=1 images=1 | READY 500x500 uploaded=63108B` — one image, the old file deleted, the uploaded byte count equal to the file's. The same PUT with the original bytes restored `SKU-001` to `openverse | by 3.0 | 95cc8965… | 315677B` and both stores to `READY 816x1524 uploaded=315677B`, with the provenance columns put back by the statement captured before the test (the bytes were identical, so the row stays honest) — `10 images`, `20` `synced` rows and `/prices` flagged `0` afterwards. The **browser** path was then run on `SKU-002` the same way: choose file → Save → `Saving…` for ~10.8s → green `image alpha synced · beta synced`, row `upload | field-notebook-a5-ui-test.jpg`, both stores `media=1 READY 768x1024 uploaded=60802B`, served bytes identical to the uploaded file. Refusals: a text body → `400 "send the image as the request body"`, an SVG → `400 "body is not a JPEG, PNG, WebP or GIF image"`. **Two bugs the browser run found, both fixed:** (1) the route first required an `image/*` Content-Type, and the browser reports `''` for a file it cannot type — so a perfectly good JPEG named `.bin` was refused, which is why the route now accepts any body and trusts the magic bytes; (2) the editor cleared its `file` state on both outcomes, leaving the native input still showing the chosen file, so a failure now keeps the file (one click to retry) and a success clears the input and the state together. `node backend/scripts/sync-images.js --self-check` additionally asserts the four sniffed formats and the filename, and a full re-run of the sync still reports `20/20 … already READY, 0 failed` — a renamed product's stale media `alt` can no longer cause a duplicate upload, because the "already there" check is now "the product has an image", not "the product has one called what I expect".
- **Blocks:** none

### [x] T-6.4 — Serve ten thumbnails without exhausting the database connection pool

- **Depends on:** `T-6.1`, `T-3.3`
- **Size:** `M`
- **Why:** on the deployed dashboard **some thumbnails were missing and the page sometimes failed to render**, because a page view needs eleven database connections and the Supabase pooler allows fifteen clients in session mode.
- **Do:**
  1. Stop each thumbnail from costing a database connection on every view: the image URL is already content-addressed (`?v=<sha256>`), so it can be cached immutably and served from the edge.
  2. Spread the ten requests out with `loading="lazy"` instead of firing them in one burst.
  3. Point the deployment at the pooler's **transaction** port so a serverless instance holds no session between requests.
- **Files / artifacts:** `backend/src/app.js`, `frontend/components/ProductImage.tsx`, Vercel production env (`PGPORT`)
- **Done when:** ten parallel thumbnail requests all answer `200` against the deployed alias, and a cached image is served without invoking the function.
- **Verify:** the live alias returns `cache-control: public, max-age=31536000, immutable` on `/images/:sku`, ten parallel `GET`s return ten `200`s, a repeat is an `x-vercel-cache: HIT`, and `/prices` plus `/` answer `200`.
- **Evidence:** 2026-09-22 — **verified.** The live logs named the cause exactly: `GET /images/SKU-009 … (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15` from `getImage`, and the same from `listPrices` on `/prices`. **Reproduced:** ten parallel requests to the live `/images/:sku` returned `500 500 200 200 200 500 500 500 500 200` (6 failures), a second burst 3, `/prices` + ten images 6 of 11, and twenty parallel 13 of 20 — the failures land on whichever request is the sixteenth client, which is why it looked random and partial. **Cost of one page view measured before the fix:** 1 (`/prices`) + 10 (thumbnails) = 11 connections, every time, because the response was `no-cache` (`age: 0`, `x-vercel-cache: MISS`). Two causes: (a) the images were uncacheable, so every page view re-queried them; (b) the deployment held **sessions** — a frozen serverless instance never runs node-postgres's idle timer, so its connection stayed open until the tenant's fifteen slots were gone. **Fix, part 1 (code):** `Cache-Control: public, max-age=31536000, immutable` — safe because the URL carries the row's `sha256`, so a replaced image is a *new* URL and nothing can go stale — plus `loading="lazy"`. **Fix, part 2 (config):** the app was run locally over the transaction port (`PGPORT=6543`) before touching production: `listPrices` returned 10 rows, `getImage('SKU-001')` returned 315677 bytes, and **10 parallel image GETs returned 10 × 200** — the app uses no prepared statements, cursors or session state, so transaction pooling is fully compatible. `PGPORT` was then set to `6543` in the **Vercel production** env (12 names before and after) and redeployed. **After:** the alias reports `cache-control: public, max-age=31536000, immutable`; three bursts (10, 10 and 20 parallel requests) returned **40 × 200, 0 failures**; a repeat request is `x-vercel-cache: HIT` (`age: 79`) with no function invocation; `/prices` → `200`; `/` → `200` with `10` thumbnails and `10` editor rows. **Local `.env` deliberately keeps `PGPORT=5432`:** the psql recipes in this file use multi-statement sessions (`begin; … rollback;`), which transaction pooling cannot keep on one backend — so local development stays on session mode and only the serverless deployment moved.
- **Blocks:** none
