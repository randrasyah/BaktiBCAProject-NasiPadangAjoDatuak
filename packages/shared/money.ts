// money.ts — util uang & pajak. Lihat CLAUDE.md §5.2, §7.1, §13.
// Semua nilai rupiah adalah INTEGER (tanpa desimal). total = gross_amount Midtrans.

// Pajak: 0% — keputusan pemilik 2026-06-29. Harga menu SUDAH termasuk pajak,
// jadi tidak ada PB1 yang ditambahkan di atas subtotal. tax selalu 0 & total =
// subtotal. Konstanta & fungsi tax dipertahankan (API stabil) agar mudah
// dihidupkan lagi bila kebijakan pajak berubah. (Dulu PB1 10%.)
export const TAX_RATE = 0;

/**
 * Format angka rupiah integer menjadi string, mis. 15000 -> "Rp 15.000".
 * Tanpa desimal (pembulatan rupiah penuh, CLAUDE.md §5.2).
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * Hitung pajak PB1 (10% dari subtotal), dibulatkan ke rupiah penuh.
 */
export function calcTax(subtotal: number): number {
  return Math.round(subtotal * TAX_RATE);
}

/**
 * Total = subtotal + pajak. Hasil integer (gross_amount untuk Midtrans).
 */
export function calcTotal(subtotal: number): number {
  return subtotal + calcTax(subtotal);
}

/**
 * Hitung sekaligus { subtotal, tax, total } dari subtotal.
 * Dipakai checkout & saat menyusun row orders / item_details Midtrans.
 */
export function calcOrderAmounts(subtotal: number): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const rounded = Math.round(subtotal);
  const tax = calcTax(rounded);
  return { subtotal: rounded, tax, total: rounded + tax };
}
