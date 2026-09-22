import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

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

// PORT is the one optional name: the deployed entry never listens, and requiring it 500s every route.
const OPTIONAL = new Map([['PORT', '3000']]);

const missing = Object.values(NAMES).filter((name) => !process.env[name] && !OPTIONAL.has(name));
if (missing.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
}

export const config = Object.fromEntries(
    Object.entries(NAMES).map(([key, name]) => [key, process.env[name] || OPTIONAL.get(name)]),
);
