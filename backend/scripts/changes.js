#!/usr/bin/env node
// The change log, grouped by operation:  node backend/scripts/changes.js [--sku SKU-001] [--limit 50]
import { pool } from '../src/db.js';
import { listChanges } from '../src/queries.js';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const at = args.indexOf(flag);
  return at === -1 ? fallback : args[at + 1];
};

const limit = Number(value('--limit', 50));
if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
  console.error('--limit must be an integer between 1 and 1000');
  process.exit(2);
}
const sku = value('--sku', null);

const rows = await listChanges({ limit, sku });

const short = (text, max = 30) => {
  if (text === null || text === undefined) return '—';
  const one = String(text).replace(/\s+/g, ' ');
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

const groups = [];
for (const row of rows) {
  const last = groups.at(-1);
  if (last && last.changeId === row.change_id) last.rows.push(row);
  else groups.push({ changeId: row.change_id, rows: [row] });
}

for (const group of groups) {
  const ended = group.rows[0].at.toISOString().replace('T', ' ').slice(0, 19);
  console.log(`\n${ended}  ${group.changeId}  (${group.rows.length} ${group.rows.length === 1 ? 'row' : 'rows'})`);
  for (const row of group.rows.slice().reverse()) {
    console.log(
      `  ${row.target.padEnd(7)} ${row.sku.padEnd(9)} ${row.field.padEnd(6)} ` +
        `${short(row.old_value, 22).padEnd(22)} -> ${short(row.new_value, 22).padEnd(22)} ` +
        `${row.status}${row.error ? `  ${short(row.error, 56)}` : ''}`,
    );
  }
}

const {
  rows: [{ n }],
} = await pool.query('select count(*)::int as n from change_log');
console.log(`\n${rows.length} of ${n} entries${sku ? ` for ${sku}` : ''}`);

await pool.end();
