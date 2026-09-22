export function flagMismatches(rows) {
  return rows.map((row) => ({
    ...row,
    // A SKU no store has reported on is flagged as well: nothing has confirmed that either store
    // holds the central price.
    has_mismatch:
      Object.values(row.stores).length === 0 ||
      Object.values(row.stores).some(
        (status) => status.status !== 'synced' || status.live_price !== row.central_price,
      ),
  }));
}
