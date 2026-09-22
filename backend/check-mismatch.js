// The runnable check for the logic that decides the dashboard's badges: flagMismatches (what counts
// as a mismatch) and mergeLivePrices (which replaces a recorded store price with the one just read).
// Offline, no framework, no database: `node backend/check-mismatch.js` from the repo root or backend/.
import assert from 'node:assert/strict';
import { flagMismatches, mergeLivePrices } from './src/prices.js';

let cases = 0;
const check = (actual, expected) => {
    assert.equal(actual, expected);
    cases++;
};

const sku = (central_price, stores) => ({ sku: 'SKU-001', name: 'Aero Travel Mug', central_price, stores });
const flagged = (row) => flagMismatches([row])[0].has_mismatch;
const synced = (live_price) => ({ status: 'synced', live_price, last_synced_at: null, error: null });
// one store's half of a live read, and the row that read produces
const read = (prices) => ({ key: 'alpha', prices: new Map(Object.entries(prices)) });
const merged = (row, live) => mergeLivePrices([row], live)[0];

// stores in step at the central price
check(flagged(sku('19.99', { alpha: synced('19.99'), beta: synced('19.99') })), false);
// one store holding something else
check(flagged(sku('19.99', { alpha: synced('19.99'), beta: synced('21.00') })), true);
// the sync itself failed, price irrelevant
check(flagged(sku('19.99', { alpha: synced('19.99'), beta: { status: 'failed', live_price: '19.99', error: 'boom' } })), true);
// no store has reported on this SKU at all
check(flagged(sku('19.99', {})), true);
// "22.0" and "22.00" are the same price, so formatting is never read as drift
check(flagged(sku('22.00', { alpha: synced('22.0'), beta: synced('22.00') })), false);

// What was read replaces what was recorded, in both directions. A store edited straight in a Shopify
// admin disagrees even though its recorded row still says `synced` …
check(merged(sku('19.99', { alpha: synced('19.99') }), [read({ 'SKU-001': '21.00' })]).stores.alpha.status, 'mismatch');
check(flagged(merged(sku('19.99', { alpha: synced('19.99') }), [read({ 'SKU-001': '21.00' })])), true);
// … and a store that now holds the central price is not flagged just because its row says otherwise.
check(flagged(merged(sku('19.99', { alpha: synced('21.00') }), [read({ 'SKU-001': '19.99' })])), false);
// A read the store refused is `failed` with no live price …
const unreadable = merged(sku('19.99', {}), [{ key: 'alpha', error: 'alpha: token request failed: HTTP 404' }]);
check(unreadable.stores.alpha.status, 'failed');
check(unreadable.stores.alpha.live_price, null);
check(flagged(unreadable), true);
// … and so is one that answered without a variant for that SKU.
check(merged(sku('19.99', {}), [read({ 'SKU-002': '19.99' })]).stores.alpha.status, 'failed');

console.log(`check-mismatch: ${cases} cases pass`);
