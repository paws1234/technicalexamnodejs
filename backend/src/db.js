// node-postgres reads the standard libpq names itself (PGHOST, PGPORT, PGDATABASE, PGUSER,
// PGPASSWORD, PGSSLMODE — see its lib/connection-parameters.js), so this module carries no
// connection settings of its own; importing config.js is what loads backend/.env first.
import './config.js';
import { Pool } from 'pg';

// Module scope, so a warm serverless instance reuses the pool instead of dialling again on every
// request. `max` is deliberately small: the Supabase pooler runs in session mode, so each
// connection the app holds occupies one pool slot for its whole life.
//
// `ssl: 'no-verify'` is what libpq's own `PGSSLMODE=require` means: encrypt, do not verify the
// chain. pg maps its separate PGSSLMODE=require to `ssl: true`, i.e. full verification, which the
// Supavisor pooler's self-signed chain fails — so without this the app could not connect while
// psql could. PGSSLMODE stays `require` in .env because psql reads that name and rejects
// `no-verify` as a value.
// ponytail: encrypted but unauthenticated. Upgrade: pass `ssl: { ca }` with Supabase's CA in.
export const pool = new Pool({ max: 2, ssl: 'no-verify' });
