import { imageUrl } from '@/lib/api';

// The bytes Supabase holds, served by the API and placed before the item name in the row.
//
// A plain <img> rather than next/image: the route is one image per SKU and its URL already carries
// the stored hash, so the optimizer would only be a second cache to invalidate when the image is
// replaced. An empty alt is deliberate — the item name is the text right next to it, and the
// thumbnail is there to be recognised, not read out twice.
//
// A SKU with no stored image keeps the column's width with a dashed placeholder, which says "none
// yet" where a broken-image icon would look like a fault.
export default function ProductImage({ sku, sha }: { sku: string; sha?: string | null }) {
  if (!sha) {
    return <div aria-hidden className="h-10 w-10 rounded border border-dashed border-gray-300" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see above
    <img
      src={imageUrl(sku, sha)}
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 rounded border border-gray-200 object-cover"
    />
  );
}
