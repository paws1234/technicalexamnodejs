import { app } from '../src/app.js';

// An Express app already is a `(req, res)` handler: no adapter, and the same object server.js listens on.
export default app;
