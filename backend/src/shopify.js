// The Shopify Admin API calls the sync makes, and the token they share.
//
// The token is minted here and never read from the environment: since admin-created custom
// apps can no longer be created, the client credentials grant is the only way to get one
// (assumption 1). It lasts 24h, so it is cached per store rather than re-minted per request.
// `backend/scripts/shopify-token.mjs` is the Phase 0 / manual equivalent of this mint.
import { config } from './config.js';

// store.key -> { token, expiresAt }. The 5-minute margin keeps a token from expiring between
// being minted and the call that uses it.
const tokenCache = new Map();

async function mintToken(store) {
  const response = await fetch(`https://${store.domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.shopifyClientId,
      client_secret: config.shopifyClientSecret,
    }),
  });

  const body = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Non-JSON body: the status and the first bytes below are the whole diagnosis.
  }

  if (!response.ok || !parsed?.access_token) {
    throw new Error(`token request for ${store.key} failed: HTTP ${response.status} ${body.slice(0, 300)}`);
  }

  return parsed;
}

export async function getAccessToken(store) {
  const cached = tokenCache.get(store.key);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const { access_token: token, expires_in: expiresIn } = await mintToken(store);
  tokenCache.set(store.key, { token, expiresAt: Date.now() + (expiresIn - 300) * 1000 });
  return token;
}

// One Admin API POST. GraphQL answers HTTP 200 even when it refuses a field (`Access denied for
// products field`), so the errors array is checked as well as the status — otherwise a refused
// query would look like an empty catalogue.
async function adminGraphql(store, query, variables) {
  const response = await fetch(
    `https://${store.domain}/admin/api/${config.shopifyApiVersion}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': await getAccessToken(store),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${store.key}: Admin API HTTP ${response.status} ${body.slice(0, 300)}`);
  }

  const parsed = JSON.parse(body);
  if (parsed.errors?.length) {
    throw new Error(`${store.key}: Admin API error ${JSON.stringify(parsed.errors).slice(0, 300)}`);
  }
  return parsed.data;
}

export async function findVariantBySku(sku, store) {
  // `product { id }` comes along because the only variant price-write left in this API version
  // (`productVariantUpdate` is gone from the Mutation type as of 2026-07) is
  // `productVariantsBulkUpdate`, which addresses the variant's product rather than the variant.
  // Reading it here saves the write a second round trip.
  // JSON.stringify produces exactly the escaping a GraphQL string literal accepts, so an odd
  // SKU cannot break out of the query.
  const data = await adminGraphql(
    store,
    `{ productVariants(first: 1, query: ${JSON.stringify(`sku:${sku}`)}) { edges { node { id price product { id } } } } }`,
  );

  const node = data?.productVariants?.edges?.[0]?.node;
  if (!node) throw new Error(`${store.key}: no variant found for sku ${sku}`);
  return { variantId: node.id, productId: node.product.id, price: node.price };
}

// Writes one variant's price. Takes the object findVariantBySku returned, so the caller never
// has to know that the product id is part of addressing the variant.
export async function updateVariantPrice(store, { variantId, productId }, price) {
  const data = await adminGraphql(
    store,
    `mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id price }
        userErrors { field message }
      }
    }`,
    { productId, variants: [{ id: variantId, price: String(price) }] },
  );

  const result = data.productVariantsBulkUpdate;
  if (result.userErrors?.length) {
    throw new Error(
      `${store.key}: price update rejected for ${variantId}: ${JSON.stringify(result.userErrors).slice(0, 300)}`,
    );
  }

  const variant = result.productVariants?.[0];
  if (!variant) {
    throw new Error(`${store.key}: price update for ${variantId} returned no variant`);
  }
  return variant.price;
}
