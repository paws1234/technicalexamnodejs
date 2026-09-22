// "22.0" and "22.00" are one price, not a mismatch: pg hands numeric(10,2) back as a string and
// Shopify's Money is a string too, so the two are compared as numbers. A missing value never
// matches, so a store that has not reported cannot look settled.
const differs = (live, central) =>
  live === null ||
  live === undefined ||
  central === null ||
  central === undefined ||
  Number(live) !== Number(central);

// Replaces each store's recorded price with the one the store holds right now: `live` carries one
// entry per store, either a sku -> price Map or the error that stopped the read. The recorded row
// is kept for `last_synced_at`, but `status` and `live_price` always describe this read, so a price
// edited straight into a Shopify admin is flagged instead of hiding behind a stale `synced`.
export function mergeLivePrices(rows, live) {
  return rows.map((row) => ({
    ...row,
    stores: Object.fromEntries(
      live.map(({ key, prices, error }) => {
        const recorded = row.stores[key] ?? {};
        const price = prices?.get(row.sku);
        if (error || price === undefined) {
          return [
            key,
            {
              ...recorded,
              status: 'failed',
              live_price: null,
              error: error ?? `${key}: no variant found for sku ${row.sku}`,
            },
          ];
        }
        return [
          key,
          {
            ...recorded,
            status: differs(price, row.central_price) ? 'mismatch' : 'synced',
            live_price: price,
            error: null,
          },
        ];
      }),
    ),
  }));
}

export function flagMismatches(rows) {
  return rows.map((row) => ({
    ...row,
    // A SKU no store has reported on is flagged as well: nothing has confirmed that either store
    // holds the central price.
    has_mismatch:
      Object.values(row.stores).length === 0 ||
      Object.values(row.stores).some(
        (status) => status.status !== 'synced' || differs(status.live_price, row.central_price),
      ),
  }));
}
