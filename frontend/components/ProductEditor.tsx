'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { replaceImage, updateProduct } from '@/lib/api';

type StoreResult = { store: string; status: string; error?: string | null };
type Note = { tone: 'ok' | 'bad'; text: string };

// One line: the failed stores with their reasons, or the stores that took the change.
function describe(result: { error?: string; stores?: StoreResult[] }): Note {
  if (result.error) return { tone: 'bad', text: result.error };
  const stores = result.stores ?? [];
  const failed = stores.filter((store) => store.status !== 'synced');
  if (failed.length > 0) {
    return { tone: 'bad', text: failed.map((store) => `${store.store}: ${store.error ?? store.status}`).join(' · ') };
  }
  return { tone: 'ok', text: stores.map((store) => `${store.store} ${store.status}`).join(' · ') };
}

const kB = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} kB`;
const FIELD = 'grid gap-1 text-xs font-medium text-gray-500';

// The row's editors behind a disclosure, so ten rows of controls do not bury the table; `router.refresh()` re-reads the row.
export default function ProductEditor({
  sku,
  name,
  imageSize,
}: {
  sku: string;
  name: string;
  imageSize: number | null;
}) {
  const [nextSku, setNextSku] = useState(sku);
  const [nextName, setNextName] = useState(name);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  // A file input owns its own value, so the DOM value is cleared too, and only once the upload lands.
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const imageState = file
    ? `${file.name} (${kB(file.size)}) will replace the stored image`
    : imageSize
      ? `current image ${kB(imageSize)}`
      : 'no image stored yet';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNote(null);
    try {
      const edited = nextSku !== sku || nextName !== name;
      if (edited) {
        const result = await updateProduct(sku, { sku: nextSku, name: nextName });
        setNote(describe(result));
        // A rejected edit leaves the catalogue untouched, so the image must not attach under a SKU nobody renamed.
        if (result.error) return;
      }

      if (file) {
        // Under the *new* SKU when the rename went through: that is what both stores now hold.
        const image = describe(await replaceImage(nextSku, file));
        // A rejection keeps the chosen file, so fixing the reason and submitting again is one click.
        if (image.tone === 'bad') {
          setNote(image);
        } else {
          // Appended, so a submit that did both reports both instead of the second hiding the first.
          setNote((current) => ({ tone: 'ok', text: current ? `${current.text} · image ${image.text}` : `image ${image.text}` }));
          setFile(null);
          if (fileInput.current) fileInput.current.value = '';
        }
      }

      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    // A grid child of the row, so `lg:col-span-full` puts the editor under it rather than in the action column.
    <details className="border-t border-dashed border-gray-200 pt-1 lg:col-span-full">
      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-900">
        Edit SKU, item name or image
      </summary>
      <form onSubmit={handleSubmit} className="mt-3 grid gap-3 lg:grid-cols-3">
        <label className={FIELD}>
          SKU
          <input
            type="text"
            required
            maxLength={64}
            value={nextSku}
            onChange={(event) => setNextSku(event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 font-mono text-xs text-gray-900"
          />
        </label>

        <label className={FIELD}>
          Item name
          <input
            type="text"
            required
            maxLength={255}
            value={nextName}
            onChange={(event) => setNextName(event.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
          />
        </label>

        <label className={FIELD}>
          Image
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-xs text-gray-900"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3 lg:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <span className="text-xs text-gray-500">{imageState}</span>
        </div>

        {note && (
          <p
            className={`text-xs break-words lg:col-span-3 ${
              note.tone === 'bad' ? 'text-red-700' : 'text-green-700'
            }`}
          >
            {note.text}
          </p>
        )}
      </form>
    </details>
  );
}
