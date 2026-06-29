-- =====================================================================
-- Iterasi 15 — Hapus pembayaran online + pajak (keputusan pemilik 2026-06-29)
--
-- Perubahan:
--   1. Tambah status 'preparing' ke CHECK orders.status
--      (lifecycle manual: pending -> preparing -> paid -> completed).
--   2. Relaksasi RLS UPDATE orders: admin (authenticated) boleh menulis
--      preparing/paid/completed (memajukan order secara manual; "Sudah Dibayar"
--      kini di-set admin, bukan webhook). Tetap tak bisa balik ke 'pending'
--      atau set 'expired'/'cancelled'.
--   3. (Opsional) Nolkan pajak order lama agar laporan konsisten —
--      DIKOMENTARI secara default; aktifkan bila ingin merapikan data historis.
--
-- CARA PAKAI: paste ke Supabase SQL Editor lalu Run. Aman di-run ulang.
-- Catatan: harga menu (menu_items.price) TIDAK diubah — sudah termasuk pajak.
-- =====================================================================

-- 1. CHECK constraint orders.status -> tambah 'preparing'.
alter table orders drop constraint if exists orders_status_check;
alter table orders
  add constraint orders_status_check
  check (status in ('pending','preparing','paid','completed','expired','cancelled'));

-- 2. RLS: ganti policy update admin (dulu hanya boleh -> 'completed').
drop policy if exists "orders_update_complete_admin" on orders;
drop policy if exists "orders_update_admin" on orders;
create policy "orders_update_admin"
  on orders
  for update
  to authenticated
  using (true)
  with check (status in ('preparing','paid','completed'));

-- 3. (OPSIONAL) Rapikan data historis: jadikan tax 0 & total = subtotal.
--    Tidak dijalankan otomatis agar tidak mengubah angka transaksi lama tanpa
--    sepengetahuan pemilik. Hapus komentar untuk mengaktifkan.
-- update orders set total = subtotal, tax = 0 where tax <> 0;

-- Selesai.
