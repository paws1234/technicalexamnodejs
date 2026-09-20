// The two sync targets, defined once so the sync loop and the forced-failure tests read the
// same registry. Deliberately no `token` here: the credential is one app pair in config that
// covers both stores, and getAccessToken(store) mints and caches each store's token from it.
import { config } from './config.js';

export const stores = [
  { key: 'alpha', domain: config.shopifyAlphaStore },
  { key: 'beta', domain: config.shopifyBetaStore },
];
