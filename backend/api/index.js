import { app } from '../src/app.js';

// An Express app already *is* a `(req, res)` handler, so this adds no adapter and no route of its
// own: it hands the same object T-1.8 listens on locally to the serverless runtime, which is what
// keeps the two environments from drifting apart.
export default app;
