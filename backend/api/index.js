import { app } from '../src/app.js';

// §3.2.1/§3.4.1 — Vercel wants a default export that is the request handler, and an Express app
// already *is* one: `(req, res) => …`. So this file adds no adapter, no express() call and no
// route of its own — it hands the same object T-1.8 listens on locally to the serverless runtime,
// which is what keeps the two environments from drifting apart.
export default app;
