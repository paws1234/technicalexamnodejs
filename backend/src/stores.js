// Both sync targets, defined once; no token here — one app credential mints and caches a per-store one.
import { config } from './config.js';

export const stores = [
  { key: 'alpha', domain: config.shopifyAlphaStore },
  { key: 'beta', domain: config.shopifyBetaStore },
];
