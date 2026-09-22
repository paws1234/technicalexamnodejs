'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { updatePrice } from '@/lib/api';

// One numeric input per row, pre-filled with the central price, PATCHed through lib/api so the base
// URL stays in one place. A <form> so Enter submits too, and the button is disabled while the
// request is in flight so a double click cannot send the same price twice.
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
      // Both failure shapes are reported rather than a generic "failed": a rejected request carries
      // `error`, an accepted one carries `stores[]` with each store's own reason.
      if (result.error) {
        setMessage(result.error);
      } else {
        // Declared rather than left `any`: `updatePrice` returns the body as-is and `next build`
        // typechecks, so an untyped callback fails the build.
        const stores: { store: string; status: string; error?: string | null }[] = result.stores ?? [];
        const failed = stores.filter((s) => s.status !== 'synced');
        setMessage(failed.length ? failed.map((s) => `${s.store}: ${s.error ?? s.status}`).join(' · ') : null);
        // Re-runs this page's server component instead of duplicating the fetch here. Skipped for a
        // rejected request, where nothing changed.
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
