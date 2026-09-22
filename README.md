# technicalexamnodejs

Task 3 — Centralized price sync. `plan.md` is the architecture, `task.md` the task breakdown.

## Deployed

**https://technicalexamnodejs.vercel.app** — one URL, both apps:

| Path | Served by |
|---|---|
| `/` | the Next.js dashboard |
| `/health`, `/prices`, `/prices/:sku` | the Express API |
| `/products/:sku`, `/images/:sku` | the Express API (dashboard edits) |

Both live in **one Vercel project**, declared as two **Services** in the root `vercel.json`
(`frontend/` and `backend/` keep their own roots and their own installs). The top-level `rewrites`
send the API paths to the `backend` service and everything else to `frontend/`; a service
receives the **original** request path, so `/prices` arrives at Express unchanged and the routes
need no prefix. The frontend declares one **binding** to the backend —
`{ "type": "service", "service": "backend", "format": "url", "env": "API_URL" }` — so Vercel
injects that URL into the frontend's server-side environment as `API_URL`. No API hostname is
hard-coded, and the **browser** needs none: with `NEXT_PUBLIC_API_URL` unset in the project the
dashboard calls the API on its own origin.

## How it fits together

```
Shopify Store A ─┐                            ┌─ GET   /prices        catalogue + live state + has_mismatch
                 ├── Express API (Vercel) ────┤  PATCH /prices/:sku  central price, then both stores
Shopify Store B ─┘                            ├─ PATCH /products/:sku SKU + item name, then both stores
         ▲                  │                 └─ PUT   /images/:sku   replace the image, then both stores
         │                  ▼
         │          Supabase Postgres ──────────── Next.js dashboard: the 10 SKUs, each store's
         └──────── (source of truth) ◀────────────  live price/status, and a per-row price editor
```

A `PATCH` runs in three steps: **A** write the central price, **B** look the variant up by SKU on
each store and write the price there, **C** record the outcome per store. Each store is synced in
its own `try`/`catch`, so one store failing is captured on its own `store_sync_status` row instead
of failing the request — the response carries `{ sku, price, stores: [{ store, status, error }] }`
and is a `502` only when *no* store took the price. The Admin API token is never stored: it is
minted per store from one Dev Dashboard app's client id/secret and cached until it expires.

The dashboard also edits the two text fields and the image, through the same per-store shape:

| Route | What it does |
|---|---|
| `GET /images/:sku` | the stored bytes, with the row's hash as `ETag` (`304` on a matching `If-None-Match`) |
| `PUT /images/:sku` | the file as the **raw request body**; magic-byte checked, stored, then each store's old media is deleted and the new file uploaded |
| `PATCH /products/:sku` | renames the SKU and/or the item name, then moves each store's variant SKU and product title to match |

A renamed SKU is a natural-key change, so both child tables (`store_sync_status`, `product_images`)
carry `on update cascade` and follow the product in one statement. The image is replaced rather than
added: the store's existing media is deleted first, so a product never holds two images. A name
change does not rewrite the media `alt` already on a store — that text is set when the image is
uploaded, and the image sync matches "the product's existing image" rather than the name, so a rename
cannot cause a duplicate upload.

A row whose stores disagree is not left for the operator to retype. `GET /prices` flags it, and the
dashboard renders a **drift resolver** on that row — *Store A holds 99.51, central is 89.51* — with
`Keep central (…)` and `Use Store A (…)`. Both options are the same `PATCH /prices/:sku` with a
different value, so whichever is chosen the two stores end up holding it: the central price moves
only when the operator chooses to adopt a store's value. A store that could not be read offers no
"use" button, because there is nothing to adopt.

## Run it locally with Docker

`docker compose up --build` needs nothing but Docker. Supabase + Vercel stay the deployment path
(plan.md Phase 4), and the *same* Supabase project is used locally, so there is one database in
every environment and no local-only branch in the application code.

| Service | Host address | What it is |
|---|---|---|
| `frontend` | http://localhost:3001 | Next.js dashboard (T-2.1) |
| `backend` | http://localhost:3000 | Express API (T-1.1) |
| `shopify` | profile `tools`, run explicitly | Shopify CLI |

The backend reaches Supabase with **node-postgres over the pooler** (decision 2026-09-20,
`task.md` assumption 10), reading the standard libpq `PG*` variables from `backend/.env` — the
same contract `psql` and `pg_dump` use, so the app, a manual query and the seed artifacts share
one credential and one connection profile. The pooler host resolves over IPv4, so the same values
work from inside a container and from Vercel; no credential is baked into the compose file.

Without Docker, the two apps run straight from their folders — this is the faster loop while working
on either one:

```bash
(cd backend  && npm install && npm start)      # API on :3000, reads backend/.env
(cd frontend && npm install && npm run dev)    # dashboard on :3001
```

`backend/.env` is git-ignored — copy `backend/.env.example` and fill it in from the table below.
`frontend/.env.local` needs `NEXT_PUBLIC_API_URL=http://localhost:3000` for local dev only.

### The database

`backend/seed/schema.sql` and `backend/seed/products.sql` are the plan's own artifacts
(T-0.11–T-0.13) holding the schema and the 10 SKUs. Both are **already applied** to the Supabase
project; to re-apply them, or to stand up a fresh project, run them there (SQL editor, or over the
pooler as below):

```bash
cd backend
DB="docker run --rm --env-file .env"
$DB -v "$PWD/seed:/seed:ro" postgres:16 psql -w -v ON_ERROR_STOP=1 -f /seed/schema.sql
$DB -v "$PWD/seed:/seed:ro" postgres:16 psql -w -v ON_ERROR_STOP=1 -f /seed/products.sql
$DB postgres:16 psql -w -t -A -c 'select count(*) from products'   # 10
```

### The Shopify CLI

```bash
docker compose run --rm shopify auth login
docker compose run --rm shopify store auth --store <store>.myshopify.com --scopes read_products,write_products
docker compose run --rm shopify store execute --store <store>.myshopify.com -q '<graphql>' --allow-mutations
```

There are two auth flows and only one of them cares where the process runs.

**`auth login`** prints a *user verification code* plus an `accounts.shopify.com/activate-with-code`
URL that you open yourself. Nothing is ever redirected back to the container — the CLI fails to
launch a browser (`Error: spawn xdg-open ENOENT`, harmlessly, since the image has none) and then
just polls — so this works over the default bridge network.

**`store auth`** is a PKCE flow whose callback is hardcoded to
`http://127.0.0.1:13387/auth/callback` and bound to `127.0.0.1` *inside the container*. Under bridge
networking the browser cannot reach that, which is why the `shopify` service runs with
`network_mode: host`: the container then shares this machine's network namespace, its `127.0.0.1`
is yours, and the redirect lands normally. Where host networking is unavailable (macOS/Windows
Docker Desktop), run `store auth` on the host instead. Its prompt "Shopify CLI will open the app
authorization page in your browser" is the step that previously could never complete.

Tokens live in the `shopify_config` volume (`$HOME/.config/shopify-cli-*`), so they survive between
`docker compose run` calls. Note `store auth` issues an **online** token tied to your session: fine for
the ad-hoc seeding and lookups above, useless to the deployed sync, which uses a **Dev Dashboard app's**
client id/secret instead (T-0.6) and mints a 24h token per store with
`node backend/scripts/shopify-token.mjs <alpha|beta>`. Nothing is ever pasted out of a store admin,
because admin-created custom apps can no longer be created.

**`store auth` also needs one manual step**, because the CLI never shows you its authorization URL:
it pipes the browser opener's output, and it only prints the URL itself when it believes the browser
* failed* — which cannot be faked from inside the container (measured: exiting 0 and exiting 1 both
leave it sitting at "will open the app authorization page" with no URL). `tools/xdg-open` therefore
writes the URL where you can read it. So while `store auth` is blocking in one terminal:

```bash
cat .shopify-auth-url   # git-ignored; open the URL it contains to approve the app
```

If a previous attempt was interrupted, free the callback port first — otherwise the CLI exits with
`Port 13387 is already in use.` A killed `docker compose run` leaves its container behind (and with
host networking it keeps holding the port):

```bash
docker rm -f $(docker ps -q --filter name=price-sync-shopify)
```

### Notes

- Compose interpolation lives in the root `.env` (git-ignored, copy `.env.example`). It only sets
  `LOCAL_UID`/`LOCAL_GID` so the containers create `node_modules` and `package-lock.json` as you
  instead of as root; unset, they run as root.
- Both app Dockerfiles add an IPv4 preference to `/etc/gai.conf`. Containers here have no IPv6
  route while DNS answers with AAAA records first, which makes `npm install` hang.
- Server components must fetch `API_URL` (`http://backend:3000` under Docker — a service name the
  browser cannot resolve); `NEXT_PUBLIC_API_URL` (`http://localhost:3000`) is only correct in the
  browser. Compose sets both for you. Deployed, the **binding** supplies `API_URL` and
  `NEXT_PUBLIC_API_URL` is deliberately left unset, so the browser uses relative paths.

## Product images

Every product in both stores carries one image, and it comes from the database rather than from the
internet at sync time:

```
Openverse (free, keyless, commercial-use licences)   searched by the product's name
        │
        ▼
Supabase `product_images`   the bytes, plus the licence, creator and source page
        │
        ▼
Shopify staged upload → productUpdate(media:)   → both stores, image READY
```

```bash
node backend/scripts/sync-images.js               # fetch what is missing, then sync both stores
node backend/scripts/sync-images.js --self-check  # offline: the search-term and matching rules
```

It is re-runnable by design: an image is fetched once and afterwards read from `product_images`, and
a store already carrying an image is left alone — the check is "does this product have one", not
"does it have one called what I expect", so **renaming a product does not trigger a re-upload** — and
a second run is therefore a verification pass, printing one line per store and SKU.

**The dashboard shows and replaces the image.** Each row renders its stored image first, before the
SKU and the item name, served from `GET /images/:sku` and cache-busted with the row's hash so a
replacement is visible without a hard refresh. `PUT /images/:sku` takes the file as the raw request
body (identified by its magic bytes, not by the browser's `Content-Type`), stores it, and replaces
the image on both stores — the old media is deleted first, so a product never ends up with two.
A row with no stored image shows a dashed placeholder instead of a broken-image icon.

**Eleven connections per page view, and why that is not eleven any more.** The page's own query plus
ten thumbnails used to be eleven database connections on every load, against a Supabase pooler that
allows fifteen clients in session mode — so a burst of thumbnails could take the last slot and the
rest answered `500` (`EMAXCONNSESSION`), which is why some images were missing on the deployed
dashboard. Three things fix it: the image URL carries the row's `sha256`, so it is served
`immutable` and an already-seen image is answered by the edge **without invoking the function at
all** (a replaced image is a new URL, so nothing goes stale); the thumbnails are `loading="lazy"`;
and the deployment connects on the pooler's **transaction** port (`PGPORT=6543`), where a connection
is held for one query rather than for the life of a serverless instance. Locally `PGPORT` stays
`5432`, because the `psql` recipes need a real session (`begin; … rollback;`).

**Choosing the image.** The search term is derived from the product name (the last two words, minus
brand adjectives, numbers and trailing words like "Set"), because a name is a description rather
than a query. A few names have no photograph of the object under any derived term — "Coasters" finds
roller coasters, "Field Notebook" finds people writing in one — so the script carries a short phrase
map for exactly those, and the photo chosen under a phrase still has to mention it. Candidates are
ranked by whole-word matches against the title and the photographer's tags, with the shortest title
that names the object winning; artwork, diagrams and unusably small files are dropped first.

**Why the bytes are stored.** Shopify's staged upload takes a file rather than a link, and
re-running the sync must not repeat the search. The row keeps the licence, the creator and the
source page, which is what makes a CC BY / BY-SA image publishable.

## Environment variables

`backend/.env` (git-ignored, from `backend/.env.example`) is the local source of the ten server-side
names; the same ten are set in the Vercel project for Production and never in the repo. The `PG*`
names are the standard libpq contract, so `psql`, `pg_dump` and node-postgres read one profile.

| Name | Used by | Where it comes from | Set in |
|---|---|---|---|
| `SHOPIFY_ALPHA_STORE` | backend | Alpha's `<handle>.myshopify.com` | `backend/.env`, Vercel |
| `SHOPIFY_BETA_STORE` | backend | Beta's `<handle>.myshopify.com` | `backend/.env`, Vercel |
| `SHOPIFY_CLIENT_ID` | backend | Dev Dashboard app client id — one app, both stores | `backend/.env`, Vercel |
| `SHOPIFY_CLIENT_SECRET` | backend | that app's client secret (secret) | `backend/.env`, Vercel |
| `SHOPIFY_API_VERSION` | backend | pinned Admin API version, e.g. `2026-07` | `backend/.env`, Vercel |
| `PGHOST` | backend, `psql` | Supabase → Project Settings → Database → Connection pooling, host `aws-<n>-<region>.pooler.supabase.com` | `backend/.env`, Vercel |
| `PGPORT` | backend, `psql` | pooler **session** mode → `5432` | `backend/.env`, Vercel |
| `PGDATABASE` | backend, `psql` | `postgres` | `backend/.env`, Vercel |
| `PGUSER` | backend, `psql` | `postgres.<project-ref>` — the pooler's username form | `backend/.env`, Vercel |
| `PGPASSWORD` | backend, `psql` | the project's database password (secret) | `backend/.env`, Vercel |
| `PGSSLMODE` | backend, `psql` | `require` — the pooler refuses unencrypted connections | `backend/.env`, Vercel |
| `ALLOWED_ORIGIN` | backend | the deployed dashboard origin (CORS) | `backend/.env`, Vercel |
| `PORT` | backend | local only — the deployed entry never listens | `backend/.env` |
| `SUPABASE_URL` | — unused | project URL; the REST route was not taken | `backend/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | — unused | service-role key; blank and not required | `backend/.env` |
| `NEXT_PUBLIC_API_URL` | frontend (browser) | API origin — required locally, **unset** in the single-deployment shape | `frontend/.env.local` |
| `API_URL` | frontend (server fetches) | **not set by hand** — injected by Vercel from the service binding; `http://backend:3000` under Docker | Vercel binding, `docker-compose.yml` |

`SHOPIFY_CLIENT_SECRET` and `PGPASSWORD` are server-only and must never appear in a
`NEXT_PUBLIC_*` variable or in client-side code.

## Known simplifications

- **`PATCH /prices/:sku` is unauthenticated.** The plan specifies no auth and adding one unasked was
  out of scope, so the route is publicly writable once deployed. Flagged, not fixed. The same is
  true of `PATCH /products/:sku` and `PUT /images/:sku`, which the dashboard feature added.
- **A renamed product keeps the media `alt` it was uploaded with.** The stores' product *title* is
  updated on a rename, but the alt text on the existing image is not re-written — that would mean
  re-uploading the file or a `fileUpdate` per store. The image sync does not depend on the alt any
  more, so the consequence is cosmetic (the store's alt can name the old title).
- **`GET /prices` reads both stores live.** Every request compares the central price against what
  each store holds right now — one Admin API query per store returning every variant as
  `sku → price`, not one query per SKU — so a price changed directly in a Shopify admin is flagged on
  the next page load. The cost is two Shopify calls per dashboard load (~0.6 s warm locally).
  `store_sync_status.live_price` is still written by `PATCH` and by
  `node backend/scripts/refresh-status.js`, but it is now the recorded log rather than what the
  dashboard compares against. A store that cannot be read is reported `failed` on every row with its
  error attached, and the endpoint still answers `200`.
- **`failed` and `mismatch` are distinct.** `failed` = the store could not be read or written at all;
  `mismatch` = the store was read and its price differs from the central one.
- **One currency, no rounding logic.** Every price is a 2-decimal `numeric(10,2)`.
- **The Dev Dashboard app grants far more scopes than it needs** (~102, against the two the plan
  asks for). Narrowing it needs a new app version *and* approval of the change on each store —
  Shopify does not apply released scopes to an existing install — so it is a manual console step.
- **The product images come from a keyless Creative Commons index**, so they are *object-appropriate*
  rather than product photography: a licensed image source, or a per-SKU asset, is what a real
  catalogue would use. An anonymous Openverse client is also limited to 20 requests a minute and 200
  a day, which is why the bytes are stored once and never re-searched. `SKU-006`'s image is the
  loosest fit of the ten (a desk with a pull-out tray), and `backend/scripts/sync-images.js` holds
  the phrase map for the names the derived terms get wrong.
- **The deployment depends on Vercel Services**, which is a beta feature. The two-project fallback
  (a project per app, with `NEXT_PUBLIC_API_URL` pointing at the backend) is why
  `backend/vercel.json` and `backend/api/index.js` still exist; under the `services` config the
  Express app is detected from `backend/src/server.js` and `backend/api/index.js` is a redundant
  second entry.
