"use client";

import { useRouter } from "next/navigation";
import { useCart } from "../lib/cart";

// Tombol "Pesan Lagi": bersihkan keranjang (jaga-jaga) lalu kembali ke menu.
export function OrderAgainButton() {
  const router = useRouter();
  const { clear } = useCart();

  return (
    <button
      type="button"
      onClick={() => {
        clear();
        router.push("/");
      }}
      className="mt-8 w-full rounded-2xl border-2 border-brown-600 bg-transparent py-3.5 text-base font-bold text-brown-600 transition-colors hover:bg-brown-600 hover:text-cream-50 active:scale-[0.98]"
    >
      Pesan Lagi
    </button>
  );
}
