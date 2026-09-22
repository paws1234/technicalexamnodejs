import './config.js';
import { Pool } from 'pg';

// ponytail: one process-wide pool with a small `max` (pooler slots are per session); `ssl: 'no-verify'`, since the chain is self-signed.
export const pool = new Pool({ max: 2, ssl: 'no-verify' });
