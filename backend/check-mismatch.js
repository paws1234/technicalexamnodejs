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
const read = (prices) => ({ key: 'alpha', prices: new Map(Object.entries(prices)) });
const merged = (row, live) => mergeLivePrices([row], live)[0];

check(flagged(sku('19.99', { alpha: synced('19.99'), beta: synced('19.99') })), false);
check(flagged(sku('19.99', { alpha: synced('19.99'), beta: synced('21.00') })), true);
check(flagged(sku('19.99', { alpha: synced('19.99'), beta: { status: 'failed', live_price: '19.99', error: 'boom' } })), true);
check(flagged(sku('19.99', {})), true);
check(flagged(sku('22.00', { alpha: synced('22.0'), beta: synced('22.00') })), false);

check(merged(sku('19.99', { alpha: synced('19.99') }), [read({ 'SKU-001': '21.00' })]).stores.alpha.status, 'mismatch');
check(flagged(merged(sku('19.99', { alpha: synced('19.99') }), [read({ 'SKU-001': '21.00' })])), true);
check(flagged(merged(sku('19.99', { alpha: synced('21.00') }), [read({ 'SKU-001': '19.99' })])), false);
const unreadable = merged(sku('19.99', {}), [{ key: 'alpha', error: 'alpha: token request failed: HTTP 404' }]);
check(unreadable.stores.alpha.status, 'failed');
check(unreadable.stores.alpha.live_price, null);
check(flagged(unreadable), true);
check(merged(sku('19.99', {}), [read({ 'SKU-002': '19.99' })]).stores.alpha.status, 'failed');

console.log(`check-mismatch: ${cases} cases pass`);
