# Supabase — Setup Manual (Iterasi 1)

Langkah yang harus **kamu** lakukan di dashboard Supabase (agent tidak punya akses ke project-mu).

## 1. Jalankan skema

1. Buka project Supabase → menu kiri **SQL Editor** → **New query**.
2. Salin SELURUH isi [`schema.sql`](./schema.sql), tempel, klik **Run**.
3. Ini membuat 3 tabel (`menu_items`, `orders`, `order_items`), mengisi seed menu (16 item, semua Rp 15.000), mengaktifkan RLS + policy, dan menambahkan tabel ke Realtime.

> Skema dirancang dijalankan **sekali** pada project bersih. Policy & seed aman di-run ulang; tabel pakai `create table if not exists`. Untuk reset total: drop tabel dulu (`drop table order_items, orders, menu_items cascade;`), lalu run ulang.

## 2. Verifikasi Realtime

`schema.sql` sudah menjalankan `alter publication supabase_realtime add table orders;` (dan `order_items`). Untuk memastikan lewat dashboard:

1. **Database → Replication** (atau **Database → Publications**).
2. Buka publication **`supabase_realtime`** → pastikan **`orders`** (dan `order_items`) tercentang/terdaftar.
3. Jika belum ada (mis. error "already member" saat run), centang manual di sana.

## 3. Verifikasi RLS aktif

- **Authentication → Policies** (atau **Database → Policies**): tiap tabel harus berstatus **RLS enabled** dan punya policy berikut:
  - `menu_items` → `menu_items_select_public` (SELECT, anon+authenticated).
  - `orders` → `orders_select_admin` (SELECT, authenticated), `orders_update_complete_admin` (UPDATE, authenticated).
  - `order_items` → `order_items_select_admin` (SELECT, authenticated).
- Tidak boleh ada policy yang mengizinkan **anon** insert/update — itu disengaja (writes lewat server route service-role).

## 4. Salin kunci ke `.env.local`

**Settings → API**. Salin ke `.env.local` tiap app (jangan ke `.env.example`; lihat root `.env.example` untuk daftar var):

| Nilai di Supabase | Env var |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Project API keys → **anon / public** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Project API keys → **service_role** (Reveal) | `SUPABASE_SERVICE_ROLE_KEY` *(server-side only)* |

```powershell
# dari root repo
Copy-Item apps\customer\.env.example apps\customer\.env.local
Copy-Item apps\admin\.env.example   apps\admin\.env.local
# lalu isi nilainya
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` mem-bypass RLS — JANGAN pernah diberi prefix `NEXT_PUBLIC_` atau dipakai di kode client.

## Catatan desain RLS (ringkas)

- **service_role** (server: `/api/checkout` & webhook) bypass RLS → satu-satunya yang boleh insert order & set status `paid`.
- **anon** (browser customer) hanya boleh baca menu. Halaman pembayaran membaca status order lewat route server, bukan akses tabel langsung.
- **authenticated** (admin login) boleh baca semua order/item, dan hanya boleh ubah `paid` → `completed`.

Detail lengkap ada di komentar dalam `schema.sql`.
