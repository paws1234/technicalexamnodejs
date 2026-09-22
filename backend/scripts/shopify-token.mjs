#!/usr/bin/env node
// Mints a short-lived Admin API access token for one store via the client credentials grant, for
// the manual Phase 0 checks — there is no longer a token to paste out of the Shopify admin
// (admin-created custom apps can no longer be created; a Dev Dashboard app mints one on demand).
// See https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
//
//   node backend/scripts/shopify-token.mjs alpha          # confirmation, token masked
//   node backend/scripts/shopify-token.mjs beta --print    # raw token, for $(...)
//
// src/shopify.js mints and caches the same token in-process at runtime.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const [storeName, ...flags] = process.argv.slice(2);
const printOnly = flags.includes('--print');

const STORES = {
  alpha: process.env.SHOPIFY_ALPHA_STORE,
  beta: process.env.SHOPIFY_BETA_STORE,
};

if (!storeName || !(storeName in STORES)) {
  console.error(
    `Usage: node backend/scripts/shopify-token.mjs <${Object.keys(STORES).join('|')}> [--print]`,
  );
  process.exit(2);
}

const store = STORES[storeName];
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

// Every missing name at once, so one run fixes the whole .env. Names only — never values.
const missing = [
  !store && `SHOPIFY_${storeName.toUpperCase()}_STORE`,
  !clientId && 'SHOPIFY_CLIENT_ID',
  !clientSecret && 'SHOPIFY_CLIENT_SECRET',
].filter(Boolean);
if (missing.length > 0) {
  console.error(`Missing in backend/.env: ${missing.join(', ')}`);
  process.exit(2);
}

const response = await fetch(`https://${store}/admin/oauth/access_token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }),
});

const body = await response.text();
let parsed = null;
try {
  parsed = JSON.parse(body);
} catch {
  // Non-JSON body: the status and the first bytes below are the whole diagnosis.
}

if (!response.ok || !parsed?.access_token) {
  console.error(`Token request for ${store} failed: HTTP ${response.status}`);
  console.error(body.slice(0, 500));
  if (body.includes('shop_not_permitted')) {
    console.error(
      [
        '',
        'shop_not_permitted means the app and the store are not in the same organisation.',
        'Client credentials only works for your own org, and a dev store created from the',
        'Shopify admin (rather than the Dev Dashboard) is not in it. Check:',
        '  Dev Dashboard -> Apps        (the app is listed)',
        '  Dev Dashboard -> Dev stores  (the store is listed)',
        'See T-0.2.',
      ].join('\n'),
    );
  }
  process.exit(1);
}

if (printOnly) {
  // Bare token only, so `TOKEN=$(...)` is safe.
  console.log(parsed.access_token);
} else {
  console.log(
    `OK ${storeName} (${store}) token=${parsed.access_token.slice(0, 10)}… ` +
      `scope=${parsed.scope} expires_in=${parsed.expires_in}`,
  );
}

// An empty `scope` is not cosmetic: the grant reads the scopes back from the app version that was
// released, so an empty list means this token can do nothing at all. Measured 2026-09-20: such a
// token came back `Access denied for products field` (ACCESS_DENIED) — the mint had looked
// successful. Exiting non-zero keeps the "exit 0" check meaningful: a *usable* credential, not
// merely a mint.
if (!parsed.scope) {
    console.error(
        [
            '',
            'WARNING: the token response carried no scopes, so this token cannot read or write anything.',
            'The app version that was released must declare read_products + write_products, and releasing',
            'new scopes does not apply them to existing installs — the change must also be approved on the',
            'store. See task.md T-0.6.',
        ].join('\n'),
    );
    process.exit(3);
}
