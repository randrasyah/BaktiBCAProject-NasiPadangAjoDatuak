-- =====================================================================
-- Ajo Datuak — Skema Database (Supabase / Postgres)
-- Sumber kebenaran: CLAUDE.md §8 (tabel), §5.1 (seed menu), §8.6 (RLS).
--
-- CARA PAKAI: paste seluruh file ini ke Supabase SQL Editor lalu Run.
-- Dirancang untuk dijalankan SEKALI pada project yang masih bersih.
-- (Policy memakai "drop ... if exists" agar aman di-run ulang; tabel TIDAK,
--  jadi kalau mau reset total, drop tabel manual dulu.)
--
-- Catatan peran (role) & RLS:
--   * service_role (server-side: /api/checkout & webhook) -> BYPASS RLS.
--     Karena itu TIDAK ada policy untuk INSERT order / set 'paid';
--     hanya server tepercaya yang boleh, dan ia melewati RLS.
--   * anon (browser customer, tanpa login) -> hanya boleh BACA menu.
--   * authenticated (admin yang login Supabase Auth) -> baca semua order,
--     dan HANYA boleh mengubah order 'paid' -> 'completed'.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABEL
-- ---------------------------------------------------------------------

-- 1.1 menu_items — daftar menu. Lihat CLAUDE.md §8.1.
create table if not exists menu_items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null check (category in ('Paket','Mandatory','Lauk','Tambahan','Minuman')),
  price        integer not null default 15000,   -- rupiah, integer (tanpa desimal)
  is_available boolean not null default true,     -- untuk fitur sold-out [OPTIONAL]
  sort_order   integer default 0,                 -- urutan tampil dalam kategori
  image_url    text,                              -- path foto di /public (mis. "/menu/rendang.jpg"); null = placeholder
  created_at   timestamptz default now()
);

-- 1.2 orders — header pesanan. Lihat CLAUDE.md §8.2.
-- status (lifecycle manual tanpa pembayaran online, 2026-06-29):
--   'pending' -> 'preparing' -> 'paid' -> 'completed' (dimajukan admin).
--   'expired'/'cancelled' = sisa alur Midtrans (dipertahankan untuk future use).
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  order_code    text unique not null,             -- human-readable, mis. AJD-20260622-0001
  table_number  text not null,
  status        text not null default 'pending'
                  check (status in ('pending','preparing','paid','completed','expired','cancelled')),
  subtotal      integer not null,                 -- jumlah harga item (rupiah, integer)
  tax           integer not null,                 -- pajak; 0 sejak 2026-06-29 (harga sudah termasuk pajak)
  total         integer not null,                 -- = subtotal (tax 0). (= gross_amount Midtrans bila pembayaran dihidupkan)
  -- data pembayaran (diisi oleh webhook / service role)
  midtrans_transaction_id text,
  payment_type            text,
  paid_at                 timestamptz,
  -- data QRIS (diisi /api/checkout saat charge Midtrans — iterasi 4)
  qris_string             text,     -- payload EMV (di-render jadi QR)
  qris_url                text,     -- URL gambar QR (action generate-qr-code)
  qris_expiry             text,     -- expiry_time Midtrans (string WIB)
  created_at    timestamptz default now(),
  completed_at  timestamptz
);

-- 1.3 order_items — baris pesanan. Snapshot nama & harga saat order
-- (jangan join ke menu_items untuk laporan). Lihat CLAUDE.md §8.3.
create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id),   -- boleh null bila item dihapus dari menu
  name         text not null,                     -- snapshot nama
  price        integer not null,                  -- snapshot harga satuan (rupiah)
  quantity     integer not null check (quantity > 0),
  note         text,                              -- catatan pelanggan, mis. "tidak pedas"
  created_at   timestamptz default now()
);

-- Index pendukung (dashboard real-time & laporan).
create index if not exists idx_orders_created_at on orders (created_at desc);
create index if not exists idx_orders_status     on orders (status);
create index if not exists idx_order_items_order  on order_items (order_id);
create index if not exists idx_menu_items_category on menu_items (category, sort_order);


-- ---------------------------------------------------------------------
-- 2. SEED MENU — CLAUDE.md §5.1 / §8.4. Semua harga 15000.
--    Hanya insert kalau tabel masih kosong (aman di-run ulang).
-- ---------------------------------------------------------------------
insert into menu_items (name, category, price, sort_order, image_url)
select * from (values
  -- Paket
  ('Paket Mahasiswa',              'Paket',     15000,  1, '/menu/paket-mahasiswa.jpg'),
  ('Paket Mahasiswa 2 (perlu dicek)', 'Paket',  15000,  2, '/menu/paket-mahasiswa-2.jpg'),
  -- Mandatory (tanpa foto — placeholder)
  ('Nasi',                         'Mandatory', 15000,  1, null),
  ('Nasi Rames',                   'Mandatory', 15000,  2, null),
  -- Lauk (item lama + foto)
  ('Rendang',                      'Lauk',      15000,  1, '/menu/rendang.jpg'),
  ('Tahu',                         'Lauk',      15000,  2, '/menu/tahu-goreng.jpg'),
  ('Lele',                         'Lauk',      15000,  3, '/menu/ikan-lele-goreng.jpg'),
  ('Telor Dadar',                  'Lauk',      15000,  4, '/menu/telor-dadar.jpg'),
  ('Ayam Cabe Ijo',                'Lauk',      15000,  5, '/menu/ayam-sambal-ijo.jpg'),
  ('Ayam Balado',                  'Lauk',      15000,  6, '/menu/ayam-balado.jpg'),
  ('Ayam Gulai',                   'Lauk',      15000,  7, null), -- belum ada foto
  -- Lauk (item baru tanpa foto — 2026-06-30)
  ('Kikil',                        'Lauk',      25000, 17, null),
  ('Telor Bulat',                  'Lauk',       8000, 18, null),
  ('Dendeng Balado',              'Lauk',      18000, 19, null),
  ('Ayam Kecap',                   'Lauk',      18000, 20, null),
  ('Ikan Nila Bakar',             'Lauk',      15000, 21, null),
  -- Tambahan (tanpa foto — 2026-06-30; tampil setelah Lauk, sebelum Minuman)
  ('Paru Goreng',                  'Tambahan',  18000,  1, null),
  ('Kerupuk Kulit',                'Tambahan',   5000,  2, null),
  ('Kerupuk Kaleng',               'Tambahan',   3000,  3, null),
  -- Lauk (item baru dari foto)
  ('Ayam Bakar',                   'Lauk',      15000,  8, '/menu/ayam-bakar.jpg'),
  ('Ayam Goreng',                  'Lauk',      15000,  9, '/menu/ayam-goreng.jpg'),
  ('Ikan Balado',                  'Lauk',      15000, 10, '/menu/ikan-balado.jpg'),
  ('Ikan Goreng',                  'Lauk',      15000, 11, '/menu/ikan-goreng.jpg'),
  ('Terong',                       'Lauk',      15000, 12, '/menu/terong.jpg'),
  -- Lauk (foto ada, nama belum pasti — ganti nama via DB nanti)
  ('Ayam (perlu dicek)',           'Lauk',      15000, 13, '/menu/ayam-perlu-dicek.jpg'),
  ('Menu (perlu dicek 1)',         'Lauk',      15000, 14, '/menu/menu-perlu-dicek-1.jpg'),
  ('Menu (perlu dicek 2)',         'Lauk',      15000, 15, '/menu/menu-perlu-dicek-2.jpg'),
  ('Menu (perlu dicek 3)',         'Lauk',      15000, 16, '/menu/menu-perlu-dicek-3.jpg'),
  -- Minuman (tanpa foto — placeholder)
  ('Es Teh Tawar',                 'Minuman',   15000,  1, null),
  ('Es Teh Manis',                 'Minuman',   15000,  2, null),
  ('Teh Hangat',                   'Minuman',   15000,  3, null),
  ('Teh Hangat Manis',             'Minuman',   15000,  4, null),
  ('Air Putih',                    'Minuman',   15000,  5, null),
  ('Es Jeruk',                     'Minuman',   15000,  6, null),
  ('Aqua',                         'Minuman',    5000,  7, null)
) as seed(name, category, price, sort_order, image_url)
where not exists (select 1 from menu_items);


-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) — CLAUDE.md §8.6
-- ---------------------------------------------------------------------
alter table menu_items  enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

-- 3.1 menu_items: BACA publik (anon & authenticated). Tulis hanya service role.
--     Tidak ada policy insert/update/delete -> anon/authenticated tidak bisa menulis;
--     service_role melewati RLS sehingga tetap bisa seed/ubah menu.
drop policy if exists "menu_items_select_public" on menu_items;
create policy "menu_items_select_public"
  on menu_items
  for select
  to anon, authenticated
  using (true);

-- 3.2 orders
--   SELECT: hanya admin (authenticated) boleh lihat SEMUA order
--           (dashboard & laporan). Customer (anon) TIDAK diberi akses baca
--           langsung; halaman pembayaran membaca status lewat route server
--           (service role). -> tidak membocorkan seluruh tabel order ke anon.
drop policy if exists "orders_select_admin" on orders;
create policy "orders_select_admin"
  on orders
  for select
  to authenticated
  using (true);

--   UPDATE: authenticated (admin) memajukan order secara MANUAL melalui
--           lifecycle pending -> preparing -> paid -> completed
--           (keputusan pemilik 2026-06-29: tidak ada pembayaran online lagi,
--           admin yang menandai "Sudah Dibayar" untuk bayar di tempat).
--           USING (true): admin boleh menyentuh baris order apa pun.
--           WITH CHECK (status in ('preparing','paid','completed')): hasil update
--           hanya boleh salah satu dari tiga status itu — admin TIDAK bisa
--           mengembalikan ke 'pending' atau men-set 'expired'/'cancelled'.
drop policy if exists "orders_update_complete_admin" on orders;
drop policy if exists "orders_update_admin" on orders;
create policy "orders_update_admin"
  on orders
  for update
  to authenticated
  using (true)
  with check (status in ('preparing','paid','completed'));

--   TIDAK ADA policy INSERT untuk anon/authenticated:
--     pembuatan order hanya lewat /api/order (service role, bypass RLS).
--   'expired'/'cancelled' hanya bisa di-set service role (webhook Midtrans,
--     bila pembayaran online dihidupkan lagi — future use).

-- 3.3 order_items
--   SELECT: hanya admin (authenticated) — untuk rincian order & laporan.
--           Customer tidak butuh baca langsung (dilayani route server bila perlu).
--   Tidak ada insert/update/delete -> hanya service role (saat /api/checkout).
drop policy if exists "order_items_select_admin" on order_items;
create policy "order_items_select_admin"
  on order_items
  for select
  to authenticated
  using (true);


-- ---------------------------------------------------------------------
-- 4. REALTIME — CLAUDE.md §8.5
--    Tambahkan tabel ke publication 'supabase_realtime' agar perubahan
--    ter-push ke client. Admin (authenticated) menerima update karena
--    punya policy SELECT di atas; Realtime tetap menghormati RLS.
--    (Customer memantau status via polling route server, lihat §8.6.)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;

-- Selesai.
