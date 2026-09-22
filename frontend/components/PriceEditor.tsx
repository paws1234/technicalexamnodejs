'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { updatePrice } from '@/lib/api';

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
      if (result.error) {
        setMessage(result.error);
      } else {
        const stores: { store: string; status: string; error?: string | null }[] = result.stores ?? [];
        const failed = stores.filter((s) => s.status !== 'synced');
        setMessage(failed.length ? failed.map((s) => `${s.store}: ${s.error ?? s.status}`).join(' · ') : null);
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
