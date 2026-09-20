# technicalexamnodejs

Task 3 — Centralized price sync. `plan.md` is the architecture, `task.md` the task breakdown.

## Run it locally with Docker

`docker compose up --build` needs nothing but Docker. Supabase cloud + Vercel stay the deployment
path (plan.md Phase 4); this stack exists so the project also runs offline against a stand-in for
Supabase.

| Service | Host address | What it is |
|---|---|---|
| `frontend` | http://localhost:3001 | Next.js dashboard (T-2.1) |
| `backend` | http://localhost:3000 | Express API (T-1.1) |
| `proxy` | http://localhost:54321 | `SUPABASE_URL` — PostgREST behind the `/rest/v1` prefix |
| `db` | `postgres://postgres:postgres@localhost:5432/postgres` | Postgres holding `products` and `store_sync_status` |
| `shopify` | profile `tools`, run explicitly | Shopify CLI |

`@supabase/supabase-js` is a PostgREST client: it always requests `<SUPABASE_URL>/rest/v1/<table>`,
exactly as Supabase's Kong gateway expects. PostgREST has no base-path option, so nginx supplies
the prefix. The application code therefore needs no local-only branch — only `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` differ from production, and the compose file sets both.

**Today the `backend` and `frontend` services exit immediately** with `Could not read package.json`
— the app code is T-1.1/T-2.1 and does not exist yet. The database, PostgREST, and proxy run now.

### The database stand-in

`backend/seed/schema.sql`, `backend/seed/products.sql` and `docker/postgrest/roles.sql` are loaded
by the `db` container on its **first** start, on an empty volume, in that order (01/02/03). The
first two are the plan's own artifacts, so the same SQL recreates the schema in the Supabase SQL
editor. After editing them: `docker compose down -v && docker compose up -d db postgrest proxy`.
`docker/postgrest/roles.sql` is local-only and `if not exists`-guarded, so it is harmless on a real
Supabase project.

Check the stack the way the backend will:

```bash
KEY=...   # the SUPABASE_SERVICE_ROLE_KEY value in docker-compose.yml — local, not a secret
curl -s "http://localhost:54321/rest/v1/products?select=sku,price&order=sku" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
curl -s "http://localhost:54321/rest/v1/?apikey=$KEY"   # OpenAPI doc: both tables and their columns
```

### The Shopify CLI

```bash
docker compose run --rm shopify store auth --store <store>.myshopify.com --scopes read_products,write_products
docker compose run --rm shopify store execute --store <store>.myshopify.com -q '<graphql>' --allow-mutations
```

It stores its token in a named volume, so authentication survives between commands. If it prints an
OAuth callback on a port other than 3456, that is the `ports:` line to change. Note `store auth`
issues an **online** token tied to your session; the tokens the sync needs are **offline** ones
from a custom app (T-0.6/T-0.7).

### Notes

- Compose interpolation lives in the root `.env` (git-ignored, copy `.env.example`). It only sets
  `LOCAL_UID`/`LOCAL_GID` so the containers create `node_modules` and `package-lock.json` as you
  instead of as root; unset, they run as root.
- Both app Dockerfiles add an IPv4 preference to `/etc/gai.conf`. Containers here have no IPv6
  route while DNS answers with AAAA records first, which makes `npm install` hang.
- Server components must fetch `API_URL` (`http://backend:3000`); `NEXT_PUBLIC_API_URL`
  (`http://localhost:3000`) is only correct in the browser. Set both in T-2.2.
