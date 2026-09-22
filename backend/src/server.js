// The local entry (the compose `backend` service); Vercel uses backend/api/index.js — same app object.
import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`backend listening on http://localhost:${config.port}`);
});
