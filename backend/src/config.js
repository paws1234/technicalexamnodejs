// The backend's environment contract. Every module reads its settings from here, so a
// missing variable is a startup error rather than a half-configured request later.
//
// Two names in .env.example are deliberately absent from NAMES: SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. The app reaches Supabase with node-postgres over the pooler
// (the PG* names below), so an empty SUPABASE_SERVICE_ROLE_KEY must not stop startup.
//
// NAMES maps the key each module uses (`config.allowedOrigin`) to the environment
// variable it comes from, so the startup check and the exported object share one list
// and a name cannot be validated in one and forgotten in the other.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Resolved from this file rather than the cwd, so backend/.env is found whether the
// process was started from the repo root or from backend/. `quiet` keeps dotenv's
// "injecting env" banner off stdout — this module is imported by the server and by
// one-liner checks whose stdout is the result.
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

// Report every missing name at once, so one run fixes the whole .env rather than one
// variable per attempt. Names only — never values.
const missing = Object.values(NAMES).filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
}

export const config = Object.fromEntries(
  Object.entries(NAMES).map(([key, name]) => [key, process.env[name]]),
);
