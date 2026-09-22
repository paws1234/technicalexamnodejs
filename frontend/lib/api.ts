// Browser uses the public origin (empty = relative paths); a server component uses the internal API_URL Vercel injects.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const API_URL = (typeof window === 'undefined' ? process.env.API_URL ?? PUBLIC_API_URL : PUBLIC_API_URL).replace(
  /\/+$/,
  '', // a service binding hands over a base URL; trim any trailing slash so joins stay honest
);

// Checked before the body, so a backend that is down cannot reach the table as an empty catalogue.
export async function getPrices() {
  const response = await fetch(`${API_URL}/prices`);
  if (!response.ok) {
    throw new Error(`GET /prices failed: HTTP ${response.status}`);
  }
  return response.json();
}

// The body comes back as-is whatever the status: 200 and 502 both carry `stores[]`, a rejection carries `error`.
export async function updatePrice(sku: string, price: string) {
  const response = await fetch(`${API_URL}/prices/${encodeURIComponent(sku)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price }),
  });
  return response.json();
}

// A URL the *browser* follows, so it uses the public base; `version` is the stored hash, which makes a replaced image a new URL.
export function imageUrl(sku: string, version: string) {
  return `${PUBLIC_API_URL}/images/${encodeURIComponent(sku)}?v=${version}`;
}

// Same return contract as updatePrice: `error` for a rejected edit, `stores[]` for one the stores answered.
export async function updateProduct(sku: string, changes: { sku: string; name: string }) {
  const response = await fetch(`${API_URL}/products/${encodeURIComponent(sku)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  return response.json();
}

// The file is the whole body (the backend reads it with `express.raw`); the type is a courtesy — magic bytes decide.
export async function replaceImage(sku: string, file: File) {
  const response = await fetch(`${API_URL}/images/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  return response.json();
}
