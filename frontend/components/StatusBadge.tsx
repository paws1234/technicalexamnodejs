const STYLES: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-800',
  synced: 'bg-green-100 text-green-800',
  mismatch: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
};

export default function StatusBadge({ status, error }: { status: string; error?: string | null }) {
  return (
    <span
      title={error ?? undefined}
      className={`inline-block justify-self-start rounded px-1.5 py-0.5 text-xs font-medium ${
        STYLES[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  );
}
