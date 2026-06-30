// constants.ts — konstanta bersama. Lihat CLAUDE.md §5.1, §8.
// Tuple `as const` dipakai juga untuk menurunkan tipe union di types.ts.

// Status order — harus sama persis dengan CHECK di tabel orders (schema.sql §1.2).
// Lifecycle baru (TANPA pembayaran online — keputusan 2026-06-29): order diproses
// MANUAL oleh admin: pending -> preparing -> paid -> completed.
//   pending    = pesanan baru masuk (belum disentuh admin)
//   preparing  = admin klik "Proses Pesanan" (customer: "Sedang Disajikan")
//   paid        = admin klik "Sudah Dibayar" (bayar langsung di tempat / tunai)
//   completed   = admin klik "Selesai"
// expired/cancelled = sisa alur pembayaran Midtrans (dipertahankan untuk future use).
export const ORDER_STATUSES = [
  "pending",
  "preparing",
  "paid",
  "completed",
  "expired",
  "cancelled",
] as const;

// Kategori menu — harus sama persis dengan CHECK di tabel menu_items (schema.sql §1.1)
// dan urutan tampil di halaman menu (CLAUDE.md §5.1).
// 'Tambahan' ditambahkan 2026-06-30 (tampil setelah Lauk, sebelum Minuman).
export const MENU_CATEGORIES = [
  "Paket",
  "Mandatory",
  "Lauk",
  "Tambahan",
  "Minuman",
] as const;

// Judul section yang DITAMPILKAN ke pelanggan per kategori. Berbeda dari nilai
// kategori di DB (yang dipakai sebagai enum). Default = nama kategori itu sendiri;
// override hanya untuk yang butuh teks berbeda. (2026-06-30)
export const CATEGORY_LABELS: Record<(typeof MENU_CATEGORIES)[number], string> = {
  Paket: "Paket Mahasiswa (WAJIB menunjukan KTM)",
  Mandatory: "Mandatory",
  Lauk: "Lauk",
  Tambahan: "Tambahan",
  Minuman: "Minuman",
};

// Harga placeholder seragam semua item (CLAUDE.md §2 poin 4).
export const DEFAULT_PRICE = 15000;

// Prefix order_code human-readable, mis. AJD-20260622-0001 (CLAUDE.md §8.2, §13).
export const ORDER_CODE_PREFIX = "AJD";
