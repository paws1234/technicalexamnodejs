// Both sync targets, defined once. No `token` here: one app credential covers both stores, and
// getAccessToken(store) mints and caches each store's token from it.
import { config } from './config.js';

export const stores = [
  { key: 'alpha', domain: config.shopifyAlphaStore },
  { key: 'beta', domain: config.shopifyBetaStore },
];
