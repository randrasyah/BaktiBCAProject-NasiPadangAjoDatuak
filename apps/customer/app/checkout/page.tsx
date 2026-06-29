"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { calcOrderAmounts, formatRupiah } from "@ajo/shared";
import { useCart } from "../../lib/cart";
import { QuantitySelector } from "../../components/QuantitySelector";
import { ArrowLeftIcon, TrashIcon } from "../../components/icons";

// useSearchParams butuh Suspense boundary (Next 15).
export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutForm />
    </Suspense>
  );
}

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lines, totalQuantity, subtotal, table, setTable, updateQuantity, removeLine, clear } =
    useCart();

  // Pre-fill nomor meja: dari cart context (di-set TableInitializer di menu),
  // fallback ke query param ?table=NN. Tetap bisa diedit.
  const [tableInput, setTableInput] = useState(
    () => table ?? searchParams.get("table") ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rincian biaya (tampilan) — sumber kebenaran dihitung ulang di server.
  const amounts = useMemo(() => calcOrderAmounts(subtotal), [subtotal]);

  const tableValid = /^\d+$/.test(tableInput.trim());

  function handleTableChange(value: string) {
    // Hanya digit.
    const digits = value.replace(/\D/g, "");
    setTableInput(digits);
    setTable(digits || null);
  }

  async function handleSubmit() {
    setError(null);
    if (totalQuantity === 0) return;
    if (!tableValid) {
      setError("Nomor meja wajib diisi (angka).");
      return;
    }
    setSubmitting(true);
    try {
      // Tanpa pembayaran online (keputusan 2026-06-29): buat order lalu lacak
      // statusnya. Route pembayaran (/api/checkout + /pay) dipertahankan untuk
      // future use.
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_number: tableInput.trim(),
          items: lines.map((l) => ({ id: l.id, quantity: l.quantity, note: l.note })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Gagal membuat pesanan.");
        setSubmitting(false);
        return;
      }
      clear();
      router.push(`/order/${data.id}`);
    } catch {
      setError("Tidak bisa terhubung ke server. Coba lagi.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] px-5 pb-40">
      <header className="flex h-16 items-center gap-3">
        <Link
          href="/"
          aria-label="Kembali ke menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-brown-800 transition-colors hover:bg-cream-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-brown-800">Keranjang</h1>
      </header>

      {totalQuantity === 0 ? (
        <div className="mt-12 rounded-2xl border border-tan-200 bg-cream-100 p-8 text-center">
          <h2 className="text-xl font-bold text-brown-800">Keranjang kosong</h2>
          <p className="mt-2 text-sm text-brown-600">Tambahkan menu dulu, yuk.</p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-brown-600 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-brown-800"
          >
            Lihat Menu
          </Link>
        </div>
      ) : (
        <>
          {/* Nomor meja */}
          <section className="mb-6">
            <label
              htmlFor="meja"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-brown-400"
            >
              Nomor Meja
            </label>
            <input
              id="meja"
              inputMode="numeric"
              pattern="\d*"
              value={tableInput}
              onChange={(e) => handleTableChange(e.target.value)}
              placeholder="mis. 12"
              aria-invalid={!tableValid}
              className="w-full rounded-2xl border border-tan-200 bg-white px-4 py-3 text-brown-900 shadow-sm transition-colors placeholder:text-brown-400 focus:border-brown-600 focus:outline-none"
            />
          </section>

          {/* Daftar item */}
          <h2 className="mb-3 font-semibold text-brown-800">Pesanan Anda</h2>
          <ul className="space-y-3">
            {lines.map((line) => (
              <li
                key={line.key}
                className="rounded-2xl border border-tan-200 bg-white p-4 shadow-[0_4px_20px_rgba(92,61,46,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-brown-900">{line.name}</p>
                    {line.note && <p className="mt-0.5 text-sm text-brown-400">{line.note}</p>}
                  </div>
                  <p className="shrink-0 font-semibold text-brown-600">
                    {formatRupiah(line.price * line.quantity)}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    aria-label={`Hapus ${line.name}`}
                    onClick={() => removeLine(line.key)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-accent transition-colors hover:bg-cream-100"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                  <QuantitySelector
                    value={line.quantity}
                    onChange={(q) => updateQuantity(line.key, q)}
                    min={1}
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* Rincian biaya — tanpa pajak (harga sudah termasuk pajak). */}
          <section className="mt-6 rounded-2xl border border-tan-200 bg-cream-100 p-5">
            <div className="flex justify-between text-lg font-bold text-brown-800">
              <span>Total</span>
              <span className="text-accent">{formatRupiah(amounts.total)}</span>
            </div>
            <p className="mt-1 text-xs text-brown-400">Harga sudah termasuk pajak.</p>
          </section>

          {error && (
            <p className="mt-4 rounded-xl border border-[#D96C6C]/40 bg-[#D96C6C]/10 px-4 py-3 text-sm text-[#9b2c2c]">
              {error}
            </p>
          )}

          {/* Tombol Pesan (sticky bawah) */}
          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] border-t border-tan-200 bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(92,61,46,0.08)]">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !tableValid}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brown-600 py-4 text-lg font-bold text-cream-50 shadow-sm transition-all hover:bg-brown-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Memproses…" : "Pesan Sekarang"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
