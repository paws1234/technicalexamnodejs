// The backend's address, which differs by caller: the browser uses the public origin —
// NEXT_PUBLIC_API_URL, or nothing at all, which makes the paths relative and works whenever the
// dashboard and the API share one deployment — while a server component runs *inside* the
// deployment and reaches the API on an internal address (`API_URL`: docker-compose sets
// `http://backend:3000`, Vercel Services injects it from a binding). Without it the server-side
// fetch would go to `localhost` inside its own container. NEXT_PUBLIC_* is inlined at build time,
// so repointing the dashboard is an env change. Nothing secret belongs here — it ships to the browser.
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const API_URL = (typeof window === 'undefined' ? process.env.API_URL ?? PUBLIC_API_URL : PUBLIC_API_URL).replace(
  /\/+$/,
  '', // a service binding hands over a base URL; trim any trailing slash so joins stay honest
);

// The status is checked before the body is returned, so a backend that is down or erroring cannot
// reach the table as an empty catalogue.
export async function getPrices() {
  const response = await fetch(`${API_URL}/prices`);
  if (!response.ok) {
    throw new Error(`GET /prices failed: HTTP ${response.status}`);
  }
  return response.json();
}

// The body comes back as-is whatever the status, because both outcomes are readable: 200 and 502
// both carry `stores[]` with each store's result, and a rejected request carries `error` instead.
export async function updatePrice(sku: string, price: string) {
  const response = await fetch(`${API_URL}/prices/${encodeURIComponent(sku)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price }),
  });
  return response.json();
}
