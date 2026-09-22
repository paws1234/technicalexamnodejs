import { getPrices } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import PriceEditor from '@/components/PriceEditor';
import ProductEditor from '@/components/ProductEditor';
import ProductImage from '@/components/ProductImage';
import DriftResolver from '@/components/DriftResolver';

const COLS =
  'lg:grid-cols-[2.75rem_4.5rem_minmax(0,1fr)_5rem_7rem_7rem_11rem] lg:items-center lg:gap-4';
const ROW = `grid gap-1.5 py-3 lg:py-2 ${COLS}`;
const CELL = 'grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 lg:contents';
const LABEL = 'text-xs uppercase tracking-wide text-gray-500 lg:hidden';

type PriceRow = {
  sku: string;
  name: string;
  central_price: string;
  image: { sha256: string; bytes: number } | null;
  has_mismatch: boolean;
  stores: {
    alpha?: { status: string; live_price?: string | null; error?: string | null };
    beta?: { status: string; live_price?: string | null; error?: string | null };
  };
};

// Per request, not prerendered, or a deployed dashboard would serve build-time prices for ever (`next build` must show `ƒ /`).
export const dynamic = 'force-dynamic';

export default async function Home() {
  const prices: PriceRow[] = await getPrices();

  return (
    <main className="mx-auto max-w-5xl p-4 lg:p-8">
      <h1 className="text-lg font-semibold">Central Price Sync</h1>
      <p className="mb-4 text-sm text-gray-600">
        {prices.length} SKUs — central price and what each store holds now.
      </p>

      <div className={`hidden lg:grid border-b border-gray-300 pb-1 text-xs uppercase tracking-wide text-gray-500 ${COLS}`}>
        <div className="lg:col-span-3">Product</div>
        <div className="text-right">Central</div>
        <div>Store A</div>
        <div>Store B</div>
        <div />
      </div>

      <ul>
        {prices.map((p) => (
          <li key={p.sku} className={`border-t border-gray-200 lg:first:border-t ${ROW}`}>
            <div className={CELL}>
              {/* On a narrow screen the thumbnail takes the label column and the SKU and name stack
                  beside it; at lg `contents` turns the same three nodes into the image, SKU and item
                  columns, which is the image-before-the-name order the row is meant to read in. */}
              <ProductImage sku={p.sku} sha={p.image?.sha256} />
              <div className="grid gap-0.5 lg:contents">
                <span className="font-mono text-xs text-gray-600">{p.sku}</span>
                <span className="text-sm font-medium">{p.name}</span>
              </div>
            </div>
            <div className={CELL}>
              <span className={LABEL}>Central</span>
              <span className="text-sm tabular-nums lg:text-right">{p.central_price}</span>
            </div>
            <div className={CELL}>
              <span className={LABEL}>Store A</span>
              <StatusBadge status={p.stores?.alpha?.status ?? 'unknown'} error={p.stores?.alpha?.error} />
            </div>
            <div className={CELL}>
              <span className={LABEL}>Store B</span>
              <StatusBadge status={p.stores?.beta?.status ?? 'unknown'} error={p.stores?.beta?.error} />
            </div>
            <div className={CELL}>
              <span className={LABEL}>Update</span>
              <PriceEditor sku={p.sku} price={p.central_price} />
            </div>
            {/* Only on a flagged row, above the editor: the two prices already disagree, so the decision comes first. */}
            {p.has_mismatch && <DriftResolver sku={p.sku} central={p.central_price} stores={p.stores} />}
            {/* A grid child of the row rather than of a cell, so its editor spans the full width
                below the row instead of the 11rem action column. */}
            <ProductEditor sku={p.sku} name={p.name} imageSize={p.image?.bytes ?? null} />
          </li>
        ))}
      </ul>
    </main>
  );
}
