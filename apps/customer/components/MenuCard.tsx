import Link from "next/link";
import type { MenuItem } from "@ajo/shared";
import { formatRupiah } from "@ajo/shared";
import { FoodImage } from "./FoodImage";

// Card menu: foto (placeholder) + nama + harga. TANPA deskripsi (CLAUDE.md §5.1).
// Klik → halaman detail item (/item/[id]).
export function MenuCard({ item }: { item: MenuItem }) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-tan-200 bg-white shadow-[0_4px_20px_rgba(92,61,46,0.08)] transition-colors hover:border-brown-600"
    >
      <FoodImage
        name={item.name}
        src={item.image_url}
        className="aspect-square w-full"
        iconClassName="h-12 w-12"
        sizes="(max-width: 480px) 50vw, 240px"
      />
      <div className="flex flex-grow flex-col justify-between gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-brown-900">{item.name}</h3>
        <p className="text-lg font-semibold text-brown-600">{formatRupiah(item.price)}</p>
      </div>
    </Link>
  );
}
