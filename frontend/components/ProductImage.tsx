import { imageUrl } from '@/lib/api';

export default function ProductImage({ sku, sha }: { sku: string; sha?: string | null }) {
  if (!sha) {
    return <div aria-hidden className="h-10 w-10 rounded border border-dashed border-gray-300" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- the URL carries the hash
    <img
      src={imageUrl(sku, sha)}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      className="h-10 w-10 rounded border border-gray-200 object-cover"
    />
  );
}
