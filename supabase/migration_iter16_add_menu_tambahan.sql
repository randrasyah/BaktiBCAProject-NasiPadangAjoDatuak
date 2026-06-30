-- =====================================================================
-- Iterasi 16 — Tambah menu baru + kategori 'Tambahan' (2026-06-30)
--
-- Perubahan:
--   1. Tambah 'Tambahan' ke CHECK menu_items.category
--      (urutan tampil: Paket -> Mandatory -> Lauk -> Tambahan -> Minuman).
--   2. Insert 9 item baru (tanpa foto / image_url null), idempotent by name.
--
-- Catatan: judul section "Paket" -> "Paket Mahasiswa (WAJIB menunjukan KTM)"
-- adalah perubahan TAMPILAN di app customer (CATEGORY_LABELS), BUKAN perubahan
-- DB — nilai kategori di DB tetap 'Paket'. Jadi tidak ada SQL untuk itu.
--
-- CARA PAKAI: paste ke Supabase SQL Editor lalu Run. Aman di-run ulang.
-- =====================================================================

-- 1. CHECK constraint menu_items.category -> tambah 'Tambahan'.
alter table menu_items drop constraint if exists menu_items_category_check;
alter table menu_items
  add constraint menu_items_category_check
  check (category in ('Paket','Mandatory','Lauk','Tambahan','Minuman'));

-- 2. Item baru (image_url null = placeholder; harga sudah termasuk pajak).
insert into menu_items (name, category, price, sort_order, image_url)
select v.name, v.category, v.price, v.sort_order, v.image_url
from (values
  -- Lauk
  ('Kikil',            'Lauk',     25000, 17, null),
  ('Telor Bulat',      'Lauk',      8000, 18, null),
  ('Dendeng Balado',   'Lauk',     18000, 19, null),
  ('Ayam Kecap',       'Lauk',     18000, 20, null),
  ('Ikan Nila Bakar',  'Lauk',     15000, 21, null),
  -- Tambahan (kategori baru; tampil setelah Lauk, sebelum Minuman)
  ('Paru Goreng',      'Tambahan', 18000,  1, null),
  ('Kerupuk Kulit',    'Tambahan',  5000,  2, null),
  ('Kerupuk Kaleng',   'Tambahan',  3000,  3, null),
  -- Minuman
  ('Aqua',             'Minuman',   5000,  7, null)
) as v(name, category, price, sort_order, image_url)
where not exists (
  select 1 from menu_items m where m.name = v.name
);

-- Selesai.
