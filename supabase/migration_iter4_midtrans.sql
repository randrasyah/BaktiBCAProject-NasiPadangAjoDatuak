-- =====================================================================
-- Migration Iterasi 4 — kolom data QRIS Midtrans pada tabel `orders`.
-- Jalankan SEKALI di Supabase SQL Editor (aman di-run ulang: IF NOT EXISTS).
--
-- Konteks: /api/checkout memanggil Midtrans charge (QRIS) lalu menyimpan
-- hasilnya agar halaman /pay/[orderId] bisa menampilkan QR tanpa memanggil
-- Midtrans lagi. (CLAUDE.md §7.1, §5.3)
-- =====================================================================

alter table orders add column if not exists qris_string text;  -- payload EMV (di-render jadi QR)
alter table orders add column if not exists qris_url    text;  -- URL gambar QR (action generate-qr-code)
alter table orders add column if not exists qris_expiry text;  -- expiry_time Midtrans (string WIB, mis. "2026-06-22 10:30:00")

-- Selesai.
