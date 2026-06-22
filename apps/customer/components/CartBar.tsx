"use client";

import Link from "next/link";
import { formatRupiah } from "@ajo/shared";
import { useCart } from "../lib/cart";
import { ArrowRightIcon, CartIcon } from "./icons";

// Bar keranjang sticky di bawah. Muncul hanya bila ada ≥1 item (CLAUDE.md §5.1).
// Menampilkan jumlah item + subtotal, tombol "Lihat Keranjang" → /checkout.
export function CartBar() {
  const { totalQuantity, subtotal } = useCart();
  if (totalQuantity === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] px-4 pb-4">
      <div className="flex items-center justify-between rounded-2xl border border-brown-400 bg-brown-600 px-4 py-3 text-cream-50 shadow-lg">
        <div className="flex items-center gap-2">
          <CartIcon className="h-5 w-5" />
          <span className="text-base font-medium">
            {totalQuantity} item · {formatRupiah(subtotal)}
          </span>
        </div>
        <Link
          href="/checkout"
          className="flex items-center gap-2 rounded-xl bg-cream-50/15 px-4 py-2 text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
        >
          Lihat Keranjang
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
