-- =====================================================================
-- Iterasi 11 — Foto menu
-- Menambah kolom `image_url` ke menu_items, mengisi foto untuk item lama,
-- dan menambah item baru dari foto yang tersedia.
--
-- CARA PAKAI: paste ke Supabase SQL Editor lalu Run. Aman di-run ulang
-- (idempotent: add column if not exists; update by name; insert hanya bila
-- nama belum ada).
--
-- Catatan: semua foto = kategori 'Lauk', KECUALI Paket Mahasiswa ('Paket').
-- File foto disimpan di apps/customer/public/menu/ → URL "/menu/<file>".
-- =====================================================================

-- 1. Kolom baru
alter table menu_items add column if not exists image_url text;

-- 2. Foto untuk item yang SUDAH ADA (cocokkan via nama).
update menu_items set image_url = '/menu/paket-mahasiswa.jpg'  where name = 'Paket Mahasiswa';
update menu_items set image_url = '/menu/rendang.jpg'          where name = 'Rendang';
update menu_items set image_url = '/menu/tahu-goreng.jpg'      where name = 'Tahu';
update menu_items set image_url = '/menu/ikan-lele-goreng.jpg' where name = 'Lele';
update menu_items set image_url = '/menu/telor-dadar.jpg'      where name = 'Telor Dadar';
update menu_items set image_url = '/menu/ayam-sambal-ijo.jpg'  where name = 'Ayam Cabe Ijo';
update menu_items set image_url = '/menu/ayam-balado.jpg'      where name = 'Ayam Balado';
-- 'Ayam Gulai', 'Nasi', 'Nasi Rames', semua Minuman: belum ada foto → tetap null (placeholder).

-- 3. Item BARU dari foto yang belum ada di menu (insert hanya bila nama belum ada).
--    Nama bertanda "(perlu dicek)" = foto ada tapi nama belum dipastikan;
--    ganti namanya kapan saja lewat: update menu_items set name='...' where name='...';
insert into menu_items (name, category, price, sort_order, image_url)
select v.name, v.category, v.price, v.sort_order, v.image_url
from (values
  -- Lauk (nama jelas)
  ('Ayam Bakar',            'Lauk',  15000,  8, '/menu/ayam-bakar.jpg'),
  ('Ayam Goreng',           'Lauk',  15000,  9, '/menu/ayam-goreng.jpg'),
  ('Ikan Balado',           'Lauk',  15000, 10, '/menu/ikan-balado.jpg'),
  ('Ikan Goreng',           'Lauk',  15000, 11, '/menu/ikan-goreng.jpg'),
  ('Terong',                'Lauk',  15000, 12, '/menu/terong.jpg'),
  -- Lauk (nama belum pasti)
  ('Ayam (perlu dicek)',    'Lauk',  15000, 13, '/menu/ayam-perlu-dicek.jpg'),
  ('Menu (perlu dicek 1)',  'Lauk',  15000, 14, '/menu/menu-perlu-dicek-1.jpg'),
  ('Menu (perlu dicek 2)',  'Lauk',  15000, 15, '/menu/menu-perlu-dicek-2.jpg'),
  ('Menu (perlu dicek 3)',  'Lauk',  15000, 16, '/menu/menu-perlu-dicek-3.jpg'),
  -- Paket (nama belum pasti)
  ('Paket Mahasiswa 2 (perlu dicek)', 'Paket', 15000, 2, '/menu/paket-mahasiswa-2.jpg')
) as v(name, category, price, sort_order, image_url)
where not exists (
  select 1 from menu_items m where m.name = v.name
);

-- Selesai.
