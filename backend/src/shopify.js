import { config } from './config.js';

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
  // `product { id }` is selected because `productVariantsBulkUpdate` addresses the product; JSON.stringify escapes the SKU safely.
  const data = await adminGraphql(
    store,
    `{ productVariants(first: 1, query: ${JSON.stringify(`sku:${sku}`)}) { edges { node { id price sku product { id title } } } } }`,
  );

  const node = data?.productVariants?.edges?.[0]?.node;
  if (!node) throw new Error(`${store.key}: no variant found for sku ${sku}`);
  return { variantId: node.id, productId: node.product.id, price: node.price, sku: node.sku, title: node.product.title };
}

// Every variant in one call as sku -> price; ponytail: the first 250 only — a bigger store would need paging.
export async function readStorePrices(store) {
  const data = await adminGraphql(store, `{ productVariants(first: 250) { nodes { sku price } } }`);
  return new Map((data?.productVariants?.nodes ?? []).map(({ sku, price }) => [sku, price]));
}

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

export async function updateProductTitle(store, productId, title) {
  const result = (
    await adminGraphql(
      store,
      `mutation ($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product { id title }
          userErrors { field message }
        }
      }`,
      { product: { id: productId, title } },
    )
  ).productUpdate;

  if (result.userErrors?.length) {
    throw new Error(
      `${store.key}: title update rejected for ${productId}: ${JSON.stringify(result.userErrors).slice(0, 300)}`,
    );
  }
  return result.product?.title;
}

export async function updateVariantSku(store, { variantId, productId }, sku) {
  const data = await adminGraphql(
    store,
    `mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id sku }
        userErrors { field message }
      }
    }`,
    { productId, variants: [{ id: variantId, inventoryItem: { sku } }] },
  );

  const result = data.productVariantsBulkUpdate;
  if (result.userErrors?.length) {
    throw new Error(
      `${store.key}: sku update rejected for ${variantId}: ${JSON.stringify(result.userErrors).slice(0, 300)}`,
    );
  }

  const variant = result.productVariants?.[0];
  if (!variant) throw new Error(`${store.key}: sku update for ${variantId} returned no variant`);
  return variant.sku;
}

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

const MEDIA_POLL_MS = 1000;
const MEDIA_ATTEMPTS = 20;

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

// Three calls: stagedUploadsCreate, POST the file, then `productUpdate` (its `media` arg replaced `productCreateMedia`); media becomes READY asynchronously.
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

export async function deleteMediaFiles(store, fileIds) {
  const result = (
    await adminGraphql(
      store,
      `mutation ($fileIds: [ID!]!) {
        fileDelete(fileIds: $fileIds) {
          deletedFileIds
          userErrors { field message }
        }
      }`,
      { fileIds },
    )
  ).fileDelete;

  if (result.userErrors?.length) {
    throw new Error(`${store.key}: media delete rejected: ${JSON.stringify(result.userErrors).slice(0, 300)}`);
  }
  return result.deletedFileIds;
}
