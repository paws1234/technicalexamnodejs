'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePrice } from '@/lib/api';

type Store = { status: string; live_price?: string | null; error?: string | null };
type StoreResult = { store: string; status: string; error?: string | null };

// The names the table's own headers use, so a button names the store the operator is looking at.
const LABEL: Record<string, string> = { alpha: 'Store A', beta: 'Store B' };
const name = (key: string) => LABEL[key] ?? key;
// "22.0" and "22.00" are one price — the same rule the flags use, so no button is offered for a
// store that already agrees with the central price.
const same = (a: string, b: string) => Number(a) === Number(b);
const BUTTON = 'rounded px-2 py-1 text-xs font-medium disabled:opacity-50';

// A drifted row is a decision, not an error: either push the central price out again, or accept
// what a store holds as the new central price. Both are the same PATCH with a different value, so
// a resolution travels the path a manual edit already takes — and either way both stores end level,
// because the chosen price is written to both.
export default function DriftResolver({
  sku,
  central,
  stores,
}: {
  sku: string;
  central: string;
  stores: Record<string, Store | undefined>;
}) {
  // Which button is in flight, so one click cannot be sent twice and only that button says so.
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();

  const entries = Object.entries(stores).filter(([, store]) => store !== undefined) as [string, Store][];
  const drifted = entries.filter(
    ([, store]) => store.status !== 'synced' || (store.live_price != null && !same(store.live_price, central)),
  );
  // Only a value we actually read can be adopted; a store whose read failed has nothing to offer.
  const adoptable = entries.filter(([, store]) => store.live_price != null && !same(store.live_price, central));

  async function resolve(action: string, value: string) {
    setPending(action);
    setNote(null);
    try {
      const result = await updatePrice(sku, value);
      if (result.error) {
        setNote(result.error);
        return;
      }
      const results: StoreResult[] = result.stores ?? [];
      const failed = results.filter((store) => store.status !== 'synced');
      // Only a failure is reported: a clean resolution removes this box with the refreshed row, so
      // an "ok" message would never be read.
      if (failed.length > 0) {
        setNote(failed.map((store) => `${name(store.store)}: ${store.error ?? store.status}`).join(' · '));
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const detail = drifted
    .map(([key, store]) =>
      store.live_price == null
        ? `${name(key)} could not be read (${store.error ?? store.status})`
        : `${name(key)} holds ${store.live_price}`,
    )
    .join(', ');

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-2 lg:col-span-full">
      <p className="text-xs text-amber-900">
        <span className="font-medium">Out of step:</span> {detail} — central is {central}. Which price
        should both stores follow?
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => resolve('central', central)}
          disabled={pending !== null}
          className={`${BUTTON} bg-gray-900 text-white`}
        >
          {pending === 'central' ? 'Sending…' : `Keep central (${central})`}
        </button>
        {adoptable.map(([key, store]) => (
          <button
            key={key}
            type="button"
            onClick={() => resolve(key, store.live_price as string)}
            disabled={pending !== null}
            className={`${BUTTON} border border-gray-400 bg-white text-gray-800`}
          >
            {pending === key ? 'Sending…' : `Use ${name(key)} (${store.live_price})`}
          </button>
        ))}
      </div>
      {note && <p className="mt-1 text-xs break-words text-red-700">{note}</p>}
    </div>
  );
}
