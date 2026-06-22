"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@ajo/shared";
import { useCart } from "../lib/cart";
import { QuantitySelector } from "./QuantitySelector";

// Form pada halaman detail: qty (min 1) + catatan opsional + tombol tambah.
// Setelah ditambah → kembali ke menu.
export function AddToCartForm({
  id,
  name,
  price,
}: {
  id: string;
  name: string;
  price: number;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  function handleAdd() {
    addItem({ id, name, price, quantity, note });
    router.push("/");
  }

  return (
    <>
      <div className="space-y-6">
        {/* Selektor jumlah */}
        <div className="flex items-center justify-between rounded-2xl border border-tan-200 bg-white p-3 shadow-[0_4px_20px_rgba(92,61,46,0.08)]">
          <span className="pl-2 text-base font-medium text-brown-800">Jumlah</span>
          <QuantitySelector value={quantity} onChange={setQuantity} min={1} />
        </div>

        {/* Catatan */}
        <div className="space-y-2">
          <label htmlFor="catatan" className="block text-lg font-medium text-brown-800">
            Catatan <span className="text-sm font-normal text-brown-400">(opsional)</span>
          </label>
          <textarea
            id="catatan"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: banyakin kuah, jangan terlalu pedas"
            className="w-full resize-none rounded-2xl border border-tan-200 bg-white p-4 text-sm text-brown-900 shadow-sm transition-colors placeholder:text-brown-400 focus:border-brown-600 focus:outline-none focus:ring-0"
          />
        </div>
      </div>

      {/* Tombol aksi (sticky bawah) */}
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] rounded-t-2xl border-t border-tan-200 bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(92,61,46,0.08)]">
        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brown-600 py-4 text-lg font-bold text-cream-50 shadow-sm transition-all hover:bg-brown-800 active:scale-[0.98]"
        >
          <span>Tambah ke Keranjang</span>
          <span className="opacity-60">·</span>
          <span>{formatRupiah(price * quantity)}</span>
        </button>
      </div>
    </>
  );
}
