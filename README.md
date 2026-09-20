# technicalexamnodejs

Task 3 — Centralized price sync. `plan.md` is the architecture, `task.md` the task breakdown.

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

**Today the `backend` and `frontend` services exit immediately** with `Could not read package.json`
— the app code is T-1.1/T-2.1 and does not exist yet.

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
- Server components must fetch `API_URL` (`http://backend:3000`); `NEXT_PUBLIC_API_URL`
  (`http://localhost:3000`) is only correct in the browser. Set both in T-2.2.
