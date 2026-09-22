import { getPrices } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import PriceEditor from '@/components/PriceEditor';

// One grid serves both widths: `md:contents` dissolves each label/value wrapper at the breakpoint,
// so a phone sees labelled lines and a desktop sees six aligned columns — a fixed table would
// scroll sideways at 375px. The last column is the price editor.
const COLS = 'md:grid-cols-[4.5rem_minmax(0,1fr)_5rem_7rem_7rem_11rem] md:items-center md:gap-4';
const ROW = `grid gap-1.5 py-3 md:py-2 ${COLS}`;
const CELL = 'grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 md:contents';
const LABEL = 'text-xs uppercase tracking-wide text-gray-500 md:hidden';

// A store entry can be absent — the endpoint reports `stores: {}` for a SKU no store has reported
// on — so the cells read it optionally rather than crashing on the one row that has no status yet.
type PriceRow = {
  sku: string;
  name: string;
  central_price: string;
  stores: {
    alpha?: { status: string; error?: string | null };
    beta?: { status: string; error?: string | null };
  };
};

// Rendered per request rather than prerendered at build time, so the table shows what the stores
// hold now: otherwise a deployed dashboard would serve build-time prices for ever and
// `router.refresh()` would re-fetch that same frozen payload. The check is `next build`'s route
// table, which must read `ƒ /` rather than `○ /`.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const prices: PriceRow[] = await getPrices();

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-lg font-semibold">Central Price Sync</h1>
      <p className="mb-4 text-sm text-gray-600">
        {prices.length} SKUs — central price and each store&apos;s last known state.
      </p>

      <div className={`hidden md:grid border-b border-gray-300 pb-1 text-xs uppercase tracking-wide text-gray-500 ${COLS}`}>
        <div>SKU</div>
        <div>Item</div>
        <div className="text-right">Central</div>
        <div>Store A</div>
        <div>Store B</div>
        <div />
      </div>

      <ul>
        {prices.map((p) => (
          <li key={p.sku} className={`border-t border-gray-200 md:first:border-t ${ROW}`}>
            <div className={CELL}>
              <span className="font-mono text-xs text-gray-600">{p.sku}</span>
              <span className="text-sm font-medium">{p.name}</span>
            </div>
            <div className={CELL}>
              <span className={LABEL}>Central</span>
              <span className="text-sm tabular-nums md:text-right">{p.central_price}</span>
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
          </li>
        ))}
      </ul>
    </main>
  );
}
