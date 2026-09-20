'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { updatePrice } from '@/lib/api';

// §3.3.4 — the action form: one numeric input per row, pre-filled with the central price, and
// the PATCH it triggers (T-2.2's client, so the base URL stays in one place). The button is
// disabled while the request is in flight, so a double click cannot send the same price twice.
// A <form> is used rather than a bare button so Enter in the input submits too.
export default function PriceEditor({ sku, price }: { sku: string; price: string }) {
  const [value, setValue] = useState(price);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await updatePrice(sku, value);
      // §3.4.3 — the two failure shapes are distinguishable, and both are reported instead of a
      // generic "failed": a request the API rejected comes back as `error`, while an accepted
      // request carries `stores[]` and each store that did not take the price carries its own
      // reason. A store-level failure names the store, and its badge turns red on the refresh.
      if (result.error) {
        setMessage(result.error);
      } else {
          // `updatePrice` returns the body as-is (T-2.2), so the shape is declared here rather than
          // left as `any` — `next build` typechecks, and an untyped callback fails the build.
          const stores: { store: string; status: string; error?: string | null }[] = result.stores ?? [];
          const failed = stores.filter((s) => s.status !== 'synced');
        setMessage(failed.length ? failed.map((s) => `${s.store}: ${s.error ?? s.status}`).join(' · ') : null);
        // §3.4.3 — the row must show the new central price and the new statuses without a manual
        // reload. `refresh()` re-runs this page's server component instead of duplicating the
        // fetch here. Skipped only for a rejected request, where nothing changed.
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-1">
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.01"
          min="0"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={`New price for ${sku}`}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm tabular-nums"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Updating…' : 'Update'}
        </button>
      </div>
      {message && <p className="text-xs break-words text-red-700">{message}</p>}
    </form>
  );
}
