// The one runnable check rules.md asks for, for the logic that cannot be verified by reading it:
// flagMismatches decides what the dashboard's status badges mean. Offline, no framework, no
// database — run it with `node backend/check-mismatch.js` from the repo root or from backend/.
import assert from 'node:assert/strict';
import { flagMismatches } from './src/prices.js';

const sku = (central_price, stores) => ({ sku: 'SKU-001', name: 'Aero Travel Mug', central_price, stores });
const flagged = (row) => flagMismatches([row])[0].has_mismatch;

const synced = (live_price) => ({ status: 'synced', live_price, last_synced_at: null, error: null });

// stores in step at the central price
assert.equal(flagged(sku('19.99', { alpha: synced('19.99'), beta: synced('19.99') })), false);
// one store holding something else
assert.equal(flagged(sku('19.99', { alpha: synced('19.99'), beta: synced('21.00') })), true);
// the sync itself failed, price irrelevant
assert.equal(flagged(sku('19.99', { alpha: synced('19.99'), beta: { status: 'failed', live_price: '19.99', error: 'boom' } })), true);
// no store has reported on this SKU at all
assert.equal(flagged(sku('19.99', {})), true);

console.log('check-mismatch: 4 cases pass');
