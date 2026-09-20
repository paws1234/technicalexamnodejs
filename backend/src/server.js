// The local entry point, and the one the compose `backend` service runs. Vercel has no default
// entry point for Express, so the deployed path is backend/api/index.js (T-3.2) — both hand the
// same app object over, which is why app.js itself never listens.
import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`backend listening on http://localhost:${config.port}`);
});
