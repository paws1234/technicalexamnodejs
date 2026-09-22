// The backend's environment contract: a missing variable is a startup error rather than a
// half-configured request later.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are deliberately absent: the app reaches Supabase
// with node-postgres over the pooler (the PG* names below), so a blank service-role key must not
// stop startup.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Resolved from this file rather than the cwd, so backend/.env is found whether the process was
// started from the repo root or from backend/. `quiet` keeps dotenv's "injecting env" banner off
// stdout — one-liner checks read stdout as the result.
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env'), quiet: true });

const NAMES = {
  port: 'PORT',
  allowedOrigin: 'ALLOWED_ORIGIN',
  pgHost: 'PGHOST',
  pgPort: 'PGPORT',
  pgDatabase: 'PGDATABASE',
  pgUser: 'PGUSER',
  pgPassword: 'PGPASSWORD',
  pgSslMode: 'PGSSLMODE',
  shopifyAlphaStore: 'SHOPIFY_ALPHA_STORE',
  shopifyBetaStore: 'SHOPIFY_BETA_STORE',
  shopifyClientId: 'SHOPIFY_CLIENT_ID',
  shopifyClientSecret: 'SHOPIFY_CLIENT_SECRET',
  shopifyApiVersion: 'SHOPIFY_API_VERSION',
};

// PORT is the one optional name: the Env vars table marks it local-only and the deployed entry
// never calls listen, so requiring it 500s every deployed route with "Missing required environment
// variable(s): PORT". The fallback is the value a local run uses when .env omits it.
const OPTIONAL = new Map([['PORT', '3000']]);

// Every missing name at once, so one run fixes the whole .env rather than one variable per
// attempt. Names only — never values.
const missing = Object.values(NAMES).filter((name) => !process.env[name] && !OPTIONAL.has(name));
if (missing.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
}

export const config = Object.fromEntries(
    Object.entries(NAMES).map(([key, name]) => [key, process.env[name] || OPTIONAL.get(name)]),
);
