// "22.0" and "22.00" are one price: pg and Shopify both send strings, so compare as numbers — a missing value never matches.
const differs = (live, central) =>
  live === null ||
  live === undefined ||
  central === null ||
  central === undefined ||
  Number(live) !== Number(central);

// `live` is one Map-or-error per store: the recorded price is replaced by what was just read, so a stale `synced` cannot hide drift.
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
    // A SKU no store has reported on is flagged too: silence is not agreement.
    has_mismatch:
      Object.values(row.stores).length === 0 ||
      Object.values(row.stores).some(
        (status) => status.status !== 'synced' || differs(status.live_price, row.central_price),
      ),
  }));
}
