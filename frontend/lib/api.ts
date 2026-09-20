// The one place the backend's address is written down. NEXT_PUBLIC_* is inlined at build time,
// so pointing the dashboard at the deployed API (T-3.5) is an env change, not a code change.
// Nothing secret belongs here — a NEXT_PUBLIC_ value ships to the browser.
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// §3.2.3 — every SKU with its central price and each store's last known state, flagged when a
// store has drifted. The status is checked before the body is returned, so a backend that is
// down or erroring cannot reach the table as an empty catalogue.
export async function getPrices() {
  const response = await fetch(`${API_URL}/prices`);
  if (!response.ok) {
    throw new Error(`GET /prices failed: HTTP ${response.status}`);
  }
  return response.json();
}

// §3.2.4 — the write that moves the central price and pushes it to both stores. The body comes
// back as-is whatever the status, because both outcomes are readable: 200 and 502 both carry
// `stores[]` with each store's result (what T-2.7 reports), and a rejected request carries
// `error` instead.
export async function updatePrice(sku: string, price: string) {
  const response = await fetch(`${API_URL}/prices/${encodeURIComponent(sku)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price }),
  });
  return response.json();
}
