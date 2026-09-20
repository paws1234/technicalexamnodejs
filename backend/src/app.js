import cors from 'cors';
import express from 'express';
import { config } from './config.js';

// No side effects on import: this module exports the app object and never listens, so
// server.js (T-1.8) owns the port and T-3.2 can hand the same object to Vercel.
export const app = express();

// The dashboard is the only browser client, so its origin is the only one allowed.
app.use(cors({ origin: config.allowedOrigin }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Four arguments is what marks this as Express's error handler. Without it a malformed
// JSON body answers with Express's HTML stack trace instead of JSON.
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  // Client errors (a malformed body) keep their message so the caller can fix the
  // request; a server error does not, so a database or Shopify failure cannot leak its
  // internals to whoever is calling.
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});
