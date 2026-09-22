// Browser uses the public origin (empty = relative paths); a server component uses the internal API_URL Vercel injects.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const API_URL = (typeof window === 'undefined' ? process.env.API_URL ?? PUBLIC_API_URL : PUBLIC_API_URL).replace(
  /\/+$/,
  '', // a service binding hands over a base URL; trim any trailing slash so joins stay honest
);

export async function getPrices() {
  const response = await fetch(`${API_URL}/prices`);
  if (!response.ok) {
    throw new Error(`GET /prices failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function updatePrice(sku: string, price: string) {
  const response = await fetch(`${API_URL}/prices/${encodeURIComponent(sku)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price }),
  });
  return response.json();
}

export function imageUrl(sku: string, version: string) {
  return `${PUBLIC_API_URL}/images/${encodeURIComponent(sku)}?v=${version}`;
}

export async function updateProduct(sku: string, changes: { sku: string; name: string }) {
  const response = await fetch(`${API_URL}/products/${encodeURIComponent(sku)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  return response.json();
}

export async function replaceImage(sku: string, file: File) {
  const response = await fetch(`${API_URL}/images/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  return response.json();
}
