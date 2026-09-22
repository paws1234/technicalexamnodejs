// The audit trail, read-only and server-rendered: one block per operation, one line per place the
// write landed.
import StatusBadge from '@/components/StatusBadge';

export type ChangeEntry = {
  id: number;
  change_id: string;
  at: string;
  target: string;
  sku: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  status: string;
  error: string | null;
};

const TARGET: Record<string, string> = { central: 'Central', alpha: 'Store A', beta: 'Store B' };
const target = (key: string) => TARGET[key] ?? key;

const value = (text: string | null) => (text === null || text === '' ? '—' : text);

export default function ChangeLog({ changes }: { changes: ChangeEntry[] }) {
  const groups: { changeId: string; rows: ChangeEntry[] }[] = [];
  for (const entry of changes) {
    const last = groups.at(-1);
    if (last && last.changeId === entry.change_id) last.rows.push(entry);
    else groups.push({ changeId: entry.change_id, rows: [entry] });
  }

  return (
    <details className="mt-8 border-t border-gray-300 pt-3">
      <summary className="cursor-pointer text-sm font-medium text-gray-700">
        Change log — {changes.length} most recent entries, {groups.length} operations
      </summary>

      <div className="mt-3 grid gap-3">
        {groups.map((group) => (
          <div key={group.changeId} className="rounded border border-gray-200 bg-gray-50 p-2">
            <p className="text-xs text-gray-500">
              {new Date(group.rows[0].at).toLocaleString()} ·{' '}
              <span className="font-mono">{group.changeId.slice(0, 8)}</span> · {group.rows.length}{' '}
              {group.rows.length === 1 ? 'row' : 'rows'}
            </p>
            <ul className="mt-1.5 grid gap-1">
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 text-xs lg:grid-cols-[5.5rem_6rem_4.5rem_minmax(0,1fr)_6rem]"
                >
                  <span className="font-medium text-gray-800">{target(row.target)}</span>
                  <span className="font-mono text-gray-600">{row.sku}</span>
                  <span className="text-gray-500">{row.field}</span>
                  <span className="truncate tabular-nums text-gray-800">
                    {value(row.old_value)} → {value(row.new_value)}
                  </span>
                  <StatusBadge status={row.status} error={row.error} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
