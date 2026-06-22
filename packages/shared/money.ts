// money.ts — util uang & pajak. Lihat CLAUDE.md §5.2, §7.1, §13.
// Semua nilai rupiah adalah INTEGER (tanpa desimal). total = gross_amount Midtrans.

// PB1 / Pajak Restoran 10% (CLAUDE.md §2 poin 2).
export const TAX_RATE = 0.1;

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
