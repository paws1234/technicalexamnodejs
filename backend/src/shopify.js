// The Shopify Admin API calls the sync makes, and the token they share.
//
// The token is minted here, never read from the environment: admin-created custom apps can no
// longer be created, so the client credentials grant is the only way to get one (assumption 1).
// It lasts 24h, so it is cached per store rather than re-minted per request.
import { config } from './config.js';

// store.key -> { token, expiresAt }. The 5-minute margin keeps a token from expiring between being
// minted and the call that uses it.
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
  // JSON.stringify produces exactly the escaping a GraphQL string literal accepts, so an odd SKU
  // cannot break out of the query.
  const data = await adminGraphql(
    store,
    `{ productVariants(first: 1, query: ${JSON.stringify(`sku:${sku}`)}) { edges { node { id price product { id } } } } }`,
  );

  const node = data?.productVariants?.edges?.[0]?.node;
  if (!node) throw new Error(`${store.key}: no variant found for sku ${sku}`);
  return { variantId: node.id, productId: node.product.id, price: node.price };
}

// Takes the object findVariantBySku returned, so the caller never has to know that the product id
// is part of addressing the variant.
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

// The inline fragment is what reaches the `image` field: `media` returns the `Media` interface,
// which has no `image` of its own.
export async function productMedia(store, productId) {
    const data = await adminGraphql(
        store,
        `query ($id: ID!) {
      product(id: $id) {
        media(first: 20) {
          nodes { id status alt mediaContentType ... on MediaImage { image { url width height } } }
        }
      }
    }`,
        { id: productId },
    );
    return data?.product?.media?.nodes ?? [];
}

// How long to wait for Shopify to finish processing an image before calling it a failure.
const MEDIA_POLL_MS = 1000;
const MEDIA_ATTEMPTS = 20;

// Processing is asynchronous: a mutation returns as soon as the file is accepted, and `status`
// moves UPLOADED/PROCESSING -> READY (or FAILED), so reporting success before READY would claim an
// image the store has not published. Exported because an already-attached media has to be waited
// for as well — a second run would otherwise add a duplicate next to it.
export async function waitForMedia(store, productId, mediaId) {
    for (let attempt = 0; attempt < MEDIA_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, MEDIA_POLL_MS));
        const node = (await productMedia(store, productId)).find((candidate) => candidate.id === mediaId);
        if (node?.status === 'READY') return node;
        if (node?.status === 'FAILED') {
            throw new Error(`${store.key}: media ${mediaId} failed processing`);
        }
    }
    throw new Error(`${store.key}: media ${mediaId} was still not READY after ${MEDIA_ATTEMPTS}s`);
}

// Attaching an image is three calls, because the bytes are ours and not a public URL: create a
// staged upload target, POST the file to it, then point the product at the staged resource.
// `productCreateMedia` no longer exists in API version 2026-07 — the `media` argument of
// `productUpdate` replaced it, and `product` has to be named there (an `identifier`-only call is
// rejected with "must include exactly one of the following arguments: input, product").
export async function addProductImage(store, productId, { filename, bytes, contentType, alt }) {
    const staged = (
        await adminGraphql(
            store,
            `mutation ($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }`,
            {
                input: [
                    { resource: 'IMAGE', filename, mimeType: contentType, fileSize: String(bytes.length), httpMethod: 'POST' },
                ],
            },
        )
    ).stagedUploadsCreate;

    if (staged.userErrors?.length) {
        throw new Error(`${store.key}: staged upload rejected: ${JSON.stringify(staged.userErrors).slice(0, 300)}`);
    }
    const target = staged.stagedTargets?.[0];
    if (!target) throw new Error(`${store.key}: staged upload returned no target`);

    // The parameters are the bucket's signed fields and have to be sent exactly as given, followed
    // by the file. FormData sets its own multipart boundary, so no Content-Type header here.
    const form = new FormData();
    for (const { name, value } of target.parameters) form.append(name, value);
    form.append('file', new Blob([bytes], { type: contentType }), filename);

    const upload = await fetch(target.url, { method: 'POST', body: form });
    if (!upload.ok) {
        throw new Error(`${store.key}: staged upload failed: HTTP ${upload.status} ${(await upload.text()).slice(0, 200)}`);
    }

    const updated = (
        await adminGraphql(
            store,
            `mutation ($productId: ID!, $media: [CreateMediaInput!]!) {
        productUpdate(product: { id: $productId }, media: $media) {
          product { media(first: 20) { nodes { id status alt } } }
          userErrors { field message }
        }
      }`,
            { productId, media: [{ originalSource: target.resourceUrl, alt, mediaContentType: 'IMAGE' }] },
        )
    ).productUpdate;

    if (updated.userErrors?.length) {
        throw new Error(`${store.key}: media rejected for ${productId}: ${JSON.stringify(updated.userErrors).slice(0, 300)}`);
    }

    const nodes = updated.product?.media?.nodes ?? [];
    const created = nodes.find((node) => node.alt === alt);
    if (!created) throw new Error(`${store.key}: product ${productId} did not report the new media`);

    return waitForMedia(store, productId, created.id);
}
