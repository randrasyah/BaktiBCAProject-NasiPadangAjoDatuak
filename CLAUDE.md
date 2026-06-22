# CLAUDE.md — MASTERPLAN: Sistem Ordering Nasi Padang Ajo Datuak

> Dokumen ini adalah sumber kebenaran tunggal (single source of truth) untuk AI agent yang membangun proyek ini. Baca seluruhnya sebelum menulis kode. Bagian yang ditandai **[WAJIB]** harus selesai & berfungsi lebih dulu. Bagian **[OPTIONAL]** hanya dikerjakan setelah seluruh fitur WAJIB terbukti bekerja end-to-end.

---

## 1. Ringkasan Proyek

Sistem pemesanan makanan untuk warung Nasi Padang **Ajo Datuak**. Pelanggan memindai QR code di meja, memesan dari menu, membayar via **QRIS**, dan pesanan langsung masuk ke dashboard pegawai/admin secara real-time. Karena bisnis ini **belum punya QRIS merchant resmi**, pembayaran QRIS untuk sementara disimulasikan menggunakan **Midtrans Sandbox + Payment Simulator** (DUMMY QRIS — QR yang di-generate di-scan/dibayar lewat Midtrans Simulator, bukan e-wallet asli).

Dibangun sebagai **monorepo** (1 Git repo) berisi **2 aplikasi web** dalam folder terpisah (`apps/customer` & `apps/admin`), berbagi **1 database Supabase**, dokumen sumber kebenaran, dan tipe/util bersama di root. Masing-masing app di-deploy sebagai **project Vercel terpisah** (lewat setting "Root Directory" per app), jadi tetap dua deployment independen dari satu repo:

| Aplikasi | Domain (Vercel) | Pengguna | Fungsi |
|---|---|---|---|
| **Customer App** | `nasipadangajodatuak.vercel.app` | Pelanggan (scan QR di meja) | Lihat menu → keranjang → checkout → bayar QRIS → konfirmasi |
| **Admin App** | `adminajodatuak.vercel.app` | Pegawai, admin, pemilik | Lihat pesanan masuk → tandai selesai → lihat laporan keuangan |

### Prinsip Desain
- **Tema warna: cream → brown.** Estetika hangat, simpel, bersih. Banyak ruang kosong (whitespace), tipografi jelas, minim ornamen. Mobile-first (pelanggan mengakses dari HP).
- **Simplicity over features.** Jangan menambah fitur yang tidak diminta. Selesaikan alur inti dulu.

---

## 2. Keputusan Final (hasil klarifikasi dengan pemilik proyek)

Ini sudah diputuskan — **jangan tanya ulang, jangan ubah**:

1. **Autentikasi Admin:** 1 login sederhana dulu (shared login). **Belum** ada role bertingkat owner/admin/pegawai. (Role granular = [OPTIONAL] nanti.)
2. **Pajak:** **PB1 / Pajak Restoran 10%** (bukan PPN 11/12%). Dihitung dari subtotal, ditambahkan ke total.
3. **Deteksi pembayaran lunas:** **Webhook Midtrans (otomatis)**. Status order berubah ke `paid` HANYA berdasarkan notifikasi server-to-server dari Midtrans — bukan dari klik di frontend. Ini krusial untuk keamanan.
4. **Harga menu:** semua item **Rp 15.000** dulu (placeholder, sama rata). Mudah diubah lewat tabel `menu_items` nanti.
5. Fitur lain (notifikasi suara, print struk, stok/sold-out) = **[OPTIONAL]**, dikerjakan paling akhir.

---

## 3. Tech Stack [WAJIB]

| Layer | Teknologi | Catatan |
|---|---|---|
| Framework (kedua app) | **Next.js (App Router) + TypeScript** | Deploy ke Vercel |
| Styling | **Tailwind CSS** | Palet custom cream/brown (lihat §9) |
| Database + Realtime | **Supabase (Postgres)** | Free tier cukup untuk skala warung ✅ |
| Auth (admin) | **Supabase Auth** (email+password, 1 akun) | Customer app TANPA login |
| Payment | **Midtrans Core API** (Sandbox) + Payment Simulator | `payment_type: "qris"` |
| Webhook handler | **Next.js Route Handler** (`/api/midtrans/webhook`) di Admin app | Verifikasi signature |
| QR code di meja | QR statis berisi URL `nasipadangajodatuak.vercel.app/?table=NN` (opsional, lihat §5.1) | Dibuat sekali |

> **Catatan Supabase Free Tier:** Ya, gratis. Cukup untuk warung kecil — termasuk Postgres, Auth, Realtime, dan API. Batasannya (project di-pause jika tidak aktif 1 minggu, 500MB DB, 2 project gratis) tidak masalah untuk use case ini. Pastikan ada minimal 1 request/minggu agar project tidak auto-pause, atau cukup login berkala.

---

## 4. Arsitektur & Alur Data

```
┌────────────────────────┐         ┌────────────────────────┐
│   CUSTOMER APP          │         │   ADMIN APP             │
│ nasipadangajodatuak     │         │ adminajodatuak          │
│ - Menu / Cart / Checkout│         │ - Login                 │
│ - Tampilkan QRIS        │         │ - Daftar pesanan (live) │
│ - Halaman sukses        │         │ - Tandai selesai        │
└───────────┬────────────┘         │ - Laporan keuangan      │
            │                      │ - /api/midtrans/webhook │
            │                      └───────────┬─────────────┘
            │  insert order                    │ update status (paid)
            ▼                                  ▼
        ┌───────────────────────────────────────────┐
        │              SUPABASE (Postgres)           │
        │  tables: menu_items, orders, order_items   │
        │  Realtime channel → push ke Admin App      │
        └───────────────────────────────────────────┘
                          ▲
                          │ webhook (settlement)
              ┌───────────┴────────────┐
              │   MIDTRANS (Sandbox)    │
              │   + Payment Simulator   │
              └─────────────────────────┘
```

### Alur pembayaran (PENTING — sumber kebenaran status = webhook)
1. Customer klik **"Pesan & Bayar"** di checkout.
2. Customer app memanggil endpoint backend sendiri (`/api/checkout`) → membuat row `orders` (status `pending`) + `order_items` di Supabase → memanggil Midtrans `/v2/charge`.
3. Midtrans mengembalikan `qr_string` + URL gambar QR. Customer app menampilkan QR.
4. Customer "membayar" lewat **Midtrans Payment Simulator** (scan/masukkan, lalu Simulator menandai settlement).
5. Midtrans mengirim **webhook** ke `adminajodatuak.vercel.app/api/midtrans/webhook`.
6. Webhook handler: verifikasi signature → cek `transaction_status` → jika `settlement`/`capture`+`accept`, update `orders.status = 'paid'` & simpan data pembayaran.
7. Customer app (yang sedang polling status order via Supabase Realtime atau polling ringan) mendeteksi status `paid` → redirect ke halaman sukses (centang).
8. Admin app menerima update realtime → pesanan kini boleh ditandai **"Selesai"**.

> ⚠️ **JANGAN** mengubah status `paid` dari frontend customer berdasarkan callback Midtrans di browser. Frontend hanya boleh *membaca* status. Hanya webhook yang boleh menulis `paid`. (Best practice resmi Midtrans.)

---

## 5. Spesifikasi Aplikasi Customer (`nasipadangajodatuak.vercel.app`)

Mobile-first. Tanpa login. State keranjang disimpan di client (React state / context). Nomor meja diisi di checkout.

### 5.1 Halaman Menu (`/` — halaman utama, langsung terbuka)
- Header sederhana: nama warung "Nasi Padang Ajo Datuak" + (opsional) nomor meja jika ada di query param `?table=NN`.
- **4 kategori** ditampilkan berurutan dengan judul section:

| Kategori | Item |
|---|---|
| **Paket** | Paket Mahasiswa |
| **Mandatory** | Nasi, Nasi Rames |
| **Lauk** | Rendang, Tahu, Lele, Telor Dadar, Ayam Cabe Ijo, Ayam Balado, Ayam Gulai |
| **Minuman** | Es Teh Tawar, Es Teh Manis, Teh Hangat, Teh Hangat Manis, Air Putih, Es Jeruk |

- Setiap item = **card**. Tampilkan nama + harga (Rp 15.000). **TIDAK ADA deskripsi.**
- Saat card ditekan → buka modal/bottom-sheet kecil berisi:
  - **Quantity selector** (− / angka / +), minimal 1.
  - **Catatan (note)** opsional, free text (mis. "tidak pedas").
  - Tombol "Tambah ke Keranjang".
- **Keranjang ringkas** muncul sebagai bar sticky di bawah (floating) begitu ada ≥1 item: tampilkan jumlah item + subtotal + tombol **"Lihat Keranjang / Checkout"**.

### 5.2 Halaman Checkout (`/checkout`)
- **Input nomor meja** (wajib, numerik). Jika datang dari `?table=NN`, pre-fill tapi tetap bisa diedit.
- **Ringkasan pesanan**: daftar item (nama, qty, note, harga per item, subtotal per baris). Boleh edit qty / hapus item di sini.
- **Rincian biaya**:
  - Subtotal
  - **Pajak Restoran (PB1) 10%** = `subtotal * 0.10`
  - **Total** = `subtotal + pajak`
  - *(Pembulatan: bulatkan total ke rupiah penuh — tidak ada desimal. gross_amount ke Midtrans = integer.)*
- Tombol **"Pesan & Bayar"** → trigger alur §4 → arahkan ke halaman pembayaran.

### 5.3 Halaman Pembayaran QRIS (`/pay/[orderId]`)
- Tampilkan **QR code** (dari `qr_string` Midtrans, render jadi gambar, ATAU hotlink URL gambar QR dari response Midtrans).
- Tampilkan total yang harus dibayar + nomor order + countdown kadaluarsa (default 15 menit).
- Teks instruksi: scan untuk membayar (selama dev: arahkan ke Midtrans Payment Simulator).
- Halaman **mendengarkan status order** via Supabase Realtime (subscribe ke row `orders` ini) atau polling tiap 3–5 detik. Saat status → `paid`, otomatis redirect ke `/success`.

### 5.4 Halaman Sukses (`/success`)
- Ikon **centang** besar + pesan "Pembayaran Berhasil".
- Tampilkan nomor order & nomor meja, ucapan terima kasih.
- (Opsional) tombol "Pesan Lagi" → kembali ke menu, reset keranjang.

---

## 6. Spesifikasi Aplikasi Admin (`adminajodatuak.vercel.app`)

### 6.0 Login (`/login`) [WAJIB]
- 1 akun shared (Supabase Auth, email+password). Semua halaman admin di-protect (redirect ke `/login` jika belum auth).

### 6.1 Dashboard Pesanan (`/` atau `/orders`) [WAJIB — TUJUAN 1]
- Daftar pesanan **real-time** (Supabase Realtime subscription), terbaru di atas.
- Tiap kartu pesanan menampilkan: **nomor order, nomor meja, daftar item + qty + note, total, status pembayaran, status penyajian, waktu.**
- **Status order** (lihat §8 untuk enum):
  - `pending` (belum bayar) → tampil jelas. Tombol **"Tandai Selesai"** tetap aktif.
  - `paid` (sudah bayar, belum disajikan) → tombol **"Tandai Selesai"** aktif.
  - `completed` (sudah disajikan) → tampil sebagai selesai.
- **Aturan "Tandai Selesai" (disederhanakan — keputusan pemilik 2026-06-22):** tombol "Tandai Selesai" bisa diklik untuk order apa pun, **tidak harus `paid` dulu**. Backend/RLS hanya menjamin update oleh admin menghasilkan status `completed`. ⚠️ Admin tetap **TIDAK** boleh men-set `paid` (itu tetap eksklusif webhook, lihat §4).
- Filter sederhana: tampilkan pesanan aktif (pending/paid) vs. riwayat (completed). [boleh minimal]

### 6.2 Laporan Keuangan (`/reports`) [WAJIB — TUJUAN 2]
- Tabel transaksi: **nomor order, waktu, nomor meja, item yang dipesan + qty, subtotal, pajak, total/nominal, status.**
- Ringkasan: total pendapatan (sum total order yang `paid`/`completed`), jumlah pesanan, (opsional) per hari.
- Filter rentang tanggal (minimal: hari ini / semua). 
- (Opsional) export CSV. → tandai [OPTIONAL].

---

## 7. Integrasi Midtrans (Sandbox + Payment Simulator) [WAJIB]

### 7.1 Konsep DUMMY QRIS
- Pakai **environment Sandbox** Midtrans (gratis, untuk testing). Tidak butuh QRIS merchant asli.
- Endpoint charge: `POST https://api.sandbox.midtrans.com/v2/charge`
- Body minimal:
  ```json
  {
    "payment_type": "qris",
    "transaction_details": { "order_id": "<ORDER_ID_UNIK>", "gross_amount": <INTEGER_TOTAL> },
    "item_details": [ { "id": "...", "price": 15000, "quantity": 1, "name": "Rendang" }, ... ],
    "qris": { "acquirer": "gopay" }
  }
  ```
  > `item_details` total harus sama dengan `gross_amount`. Jika ada pajak, masukkan pajak sebagai baris item tersendiri (mis. `{ "id": "tax", "name": "Pajak Restoran 10%", "price": <pajak>, "quantity": 1 }`) supaya jumlah cocok. **Wajib** cocok, kalau tidak Midtrans menolak.
- Response berisi `qr_string` (untuk di-render jadi QR) dan `actions[].url` gambar QR. Tampilkan salah satu.
- **Pembayaran disimulasikan** lewat **Midtrans Simulator**: https://simulator.sandbox.midtrans.com/ (pilih QRIS, scan/masukkan, tandai sebagai paid). Ini yang dimaksud "scan QR-nya ke Midtrans payment simulator".

### 7.2 Auth ke Midtrans
- Header `Authorization: Basic base64(SERVER_KEY + ":")`. Pakai **Sandbox Server Key**.
- Semua panggilan charge dilakukan di **server-side** (Route Handler), JANGAN expose Server Key ke client.

### 7.3 Webhook / HTTP Notification [WAJIB]
- Set **Notification URL** di Midtrans Dashboard (Sandbox) → `https://adminajodatuak.vercel.app/api/midtrans/webhook`.
- Handler harus:
  1. **Verifikasi signature**: `sha512(order_id + status_code + gross_amount + ServerKey)` == `signature_key`. Tolak jika tidak cocok.
  2. Baca `transaction_status` + `fraud_status`:
     - `settlement` (atau `capture` + `fraud_status=accept`) → set order `paid`.
     - `pending` → biarkan `pending`.
     - `expire` / `cancel` / `deny` → set order `expired`/`cancelled` (sesuai enum §8).
  3. Update tabel `orders` berdasarkan `order_id`. Idempotent (webhook bisa terkirim >1x — jangan dobel proses).
  4. Selalu balas HTTP 200 cepat.
- **JANGAN** mengandalkan callback browser untuk menandai lunas. Sumber kebenaran = webhook (atau Get Status API sebagai cadangan).

### 7.4 Env Vars yang dibutuhkan
```
# Supabase (kedua app)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only (untuk webhook & checkout insert tepercaya)

# Midtrans (server-side only)
MIDTRANS_SERVER_KEY=              # Sandbox
MIDTRANS_CLIENT_KEY=             # jika perlu
MIDTRANS_IS_PRODUCTION=false
```
> Service Role Key & Midtrans Server Key TIDAK boleh ada di kode client / `NEXT_PUBLIC_*`.

---

## 8. Skema Database (Supabase / Postgres) [WAJIB]

```sql
-- 8.1 Menu
create table menu_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null check (category in ('Paket','Mandatory','Lauk','Minuman')),
  price       integer not null default 15000,   -- rupiah, integer
  is_available boolean not null default true,    -- untuk fitur sold-out [OPTIONAL]
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

-- 8.2 Orders
-- status: 'pending' | 'paid' | 'completed' | 'expired' | 'cancelled'
create table orders (
  id            uuid primary key default gen_random_uuid(),
  order_code    text unique not null,            -- nomor order human-readable, mis. AJD-20260622-0001
  table_number  text not null,
  status        text not null default 'pending'
                check (status in ('pending','paid','completed','expired','cancelled')),
  subtotal      integer not null,
  tax           integer not null,                -- PB1 10%
  total         integer not null,                -- subtotal + tax (= gross_amount Midtrans)
  -- data pembayaran (diisi webhook)
  midtrans_transaction_id text,
  payment_type            text,
  paid_at                 timestamptz,
  created_at    timestamptz default now(),
  completed_at  timestamptz
);

-- 8.3 Order items (snapshot harga & nama saat order, jangan join ke menu_items untuk laporan)
create table order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id),
  name        text not null,        -- snapshot
  price       integer not null,     -- snapshot harga satuan
  quantity    integer not null check (quantity > 0),
  note        text,                 -- catatan pelanggan
  created_at  timestamptz default now()
);
```

### 8.4 Seed data menu
Isi `menu_items` dengan 4 kategori & item dari §5.1, semua `price = 15000`.

### 8.5 Realtime
- Aktifkan Realtime pada tabel `orders` (dan `order_items` jika perlu) agar Admin app & halaman pembayaran Customer dapat update otomatis.

### 8.6 Row Level Security (RLS) [WAJIB — penting]
- **menu_items**: SELECT publik (anon boleh baca). Tulis hanya service role.
- **orders / order_items**:
  - INSERT order baru oleh customer: lakukan lewat **server-side route** (`/api/checkout`) memakai service role — JANGAN izinkan anon insert sembarangan. (Alternatif lebih ketat daripada membuka insert untuk anon.)
  - UPDATE status `paid`: hanya lewat webhook (service role).
  - UPDATE status `completed`: hanya untuk user terautentikasi (admin). **Disederhanakan (keputusan pemilik 2026-06-22):** tidak ada syarat status saat ini harus `paid` — admin boleh menandai `completed` dari status mana pun. Enforce: update oleh admin hanya boleh menghasilkan status `completed` (admin tetap tidak boleh men-set `paid`).
  - SELECT: admin (authenticated) boleh lihat semua. Halaman pembayaran customer hanya perlu baca 1 order miliknya — boleh diakses via route server atau policy terbatas pada `id` order tertentu.
- Pastikan **tidak ada** policy yang mengizinkan customer mengubah `status` ke `paid`/`completed` dari client.

---

## 9. Desain Visual & Tema [WAJIB mengikuti arah ini]

**Mood:** hangat, bersih, simpel — seperti kemasan nasi padang modern. Cream sebagai background, brown untuk teks/aksen.

Palet acuan (boleh disesuaikan via Tailwind config):
```
cream-50:  #FBF7F0   (background utama)
cream-100: #F5EDE0
tan-200:   #E8D8C3   (border / card surface)
brown-400: #B08968   (aksen sekunder)
brown-600: #8B5E3C   (tombol utama / aksen)
brown-800: #5C3D2E   (teks utama / heading)
brown-900: #3E2A20   (teks gelap)
accent:    #C77F43   (highlight / harga / CTA hover)  -- opsional, terracotta hangat
```
Pedoman:
- Tipografi: 1 font bersih (mis. Inter / Plus Jakarta Sans). Heading tebal warna `brown-800`.
- Tombol utama: background `brown-600`, teks cream, rounded-xl, sedikit shadow lembut.
- Card menu: background cream/putih hangat, border `tan-200`, radius besar, padding lega.
- Hindari gradient mencolok, hindari warna selain keluarga cream/brown (kecuali hijau lembut untuk status "sukses/selesai" & merah lembut untuk error).
- Banyak whitespace, hierarki jelas, mobile-first (Customer). Admin boleh lebih padat (tabel) tapi tetap pakai palet sama.

---

## 10. Struktur Proyek — MONOREPO

Satu Git repo. Dua app di folder terpisah, dokumen & tipe bersama di root. Tiap app = satu project Vercel terpisah (set **Root Directory** ke `apps/customer` atau `apps/admin` di dashboard Vercel). Pakai npm/pnpm workspaces opsional; minimal cukup dua app Next.js berdampingan + folder `packages/shared` untuk tipe & util bersama (skema, format rupiah, perhitungan pajak, konstanta status).

```
ajo-datuak/                      # root repo
  CLAUDE.md                      # sumber kebenaran (masterplan) — JANGAN diubah agent tanpa diminta
  CONTEXT.md                     # state pembangunan saat ini — diupdate tiap iterasi
  DECISIONS.md                   # log keputusan teknis — append tiap iterasi
  package.json                   # root (workspaces opsional)
  .gitignore                     # WAJIB ignore .env*, node_modules, .next

  packages/
    shared/                      # dipakai kedua app
      types.ts                   # Order, OrderItem, MenuItem, OrderStatus, dll
      money.ts                   # format Rupiah, hitung pajak PB1 10%, pembulatan
      constants.ts               # enum status, nama kategori, dll

  apps/
    customer/                    # nasipadangajodatuak (MOBILE)
      app/
        page.tsx                 # menu (home)
        item/[id]/page.tsx       # halaman detail item (qty + note)
        checkout/page.tsx
        pay/[orderId]/page.tsx   # tampil QRIS, listen status
        success/page.tsx
        api/checkout/route.ts    # buat order + charge Midtrans (server-side)
      lib/                       # supabase client, midtrans, cart context
      ...

    admin/                       # adminajodatuak (TABLET)
      app/
        login/page.tsx
        (protected)/orders/page.tsx
        (protected)/reports/page.tsx
        api/midtrans/webhook/route.ts   # webhook penerima notifikasi Midtrans
      lib/                       # supabase client + admin (service role), auth
      ...
```

> Catatan deploy: karena webhook Midtrans harus punya URL publik, **webhook hidup di app admin** (`apps/admin`), domain `adminajodatuak.vercel.app`. Notification URL di Midtrans Dashboard diarahkan ke sana. Untuk testing lokal, pakai tunneling (mis. `ngrok`) agar Midtrans bisa menjangkau webhook di mesin lokal — atau tandai pembayaran via Get Status API saat dev. (Lihat MASTERPROMPT untuk detail per-iterasi.)

---

## 11. Urutan Pengerjaan (Build Order)

> Selesaikan & uji tiap tahap sebelum lanjut. Jangan lompat ke [OPTIONAL] sebelum 1–8 beres.

**[WAJIB]**
1. **Setup Supabase**: buat project, jalankan skema §8, seed menu §8.4, aktifkan Realtime, set RLS §8.6.
2. **Customer – Menu & Cart**: halaman menu 4 kategori, card foto tanpa deskripsi, halaman detail item (`/item/[id]`) untuk qty+note, cart bar sticky.
3. **Customer – Checkout**: input meja, ringkasan, hitung pajak PB1 10%, total.
4. **Backend – `/api/checkout`**: insert `orders` + `order_items` (status pending) via service role, panggil Midtrans charge, kembalikan QR.
5. **Customer – Halaman QRIS** (`/pay/[orderId]`): render QR, listen status realtime.
6. **Webhook Midtrans** (`/api/midtrans/webhook` di app admin): verifikasi signature, update `paid`, idempotent. Untuk dev lokal, pakai `ngrok` agar Midtrans menjangkau webhook + set Notification URL ke URL ngrok; uji via Payment Simulator.
7. **Customer – Halaman Sukses**: redirect otomatis saat `paid`.
8. **Admin – Login + Dashboard Pesanan**: realtime list, tombol "Tandai Selesai" (aktif hanya jika `paid`, enforce di UI+backend).
9. **Admin – Laporan Keuangan**: tabel + ringkasan pendapatan.
10. **Polish tema cream/brown** (§9), responsif, empty states, error states.
11. **Deploy** (paling akhir): kedua app ke Vercel sebagai 2 project terpisah (Root Directory `apps/customer` & `apps/admin`), set env vars, ganti Notification URL Midtrans ke domain produksi admin, uji end-to-end penuh. Sebelum tahap ini, semua dikerjakan & diuji **lokal** (`npm run dev`).

**[OPTIONAL] (hanya setelah semua di atas berfungsi):**
- Role bertingkat (owner/admin/pegawai) dengan hak akses berbeda (mis. hanya pemilik lihat laporan).
- Harga per item yang berbeda-beda + editor menu di admin.
- Notifikasi suara saat pesanan baru masuk di dashboard admin.
- Print struk (thermal/PDF) untuk dapur atau pelanggan.
- Toggle stok / sold-out (`is_available`) per item + sembunyikan dari menu.
- Export CSV laporan, filter tanggal lanjutan, grafik pendapatan.
- QR statis per meja (generate URL `?table=NN`).

---

## 12. Definition of Done (kriteria selesai untuk fase WAJIB)

- [ ] Pelanggan bisa buka menu, pilih item (qty+note), checkout dengan nomor meja.
- [ ] Pajak PB1 10% dihitung benar; total = gross_amount yang dikirim ke Midtrans.
- [ ] QRIS ter-generate (Sandbox) dan tampil; pembayaran via Payment Simulator berhasil.
- [ ] Webhook mengubah status order ke `paid` dengan signature terverifikasi & idempotent.
- [ ] Customer otomatis ke halaman sukses (centang) setelah `paid`.
- [ ] Admin login, melihat pesanan real-time, dan bisa menandai "Selesai" (tanpa syarat harus `paid` dulu — disederhanakan; admin tetap tidak bisa men-set `paid`).
- [ ] Laporan keuangan menampilkan order, item, qty, nominal, dengan total pendapatan.
- [ ] Tema cream→brown diterapkan konsisten; mobile-first untuk customer.
- [ ] Status `paid` TIDAK pernah bisa di-set dari frontend customer (hanya webhook).

---

## 13. Catatan Keamanan & Edge Cases (jangan dilewat)

- Semua secret (Service Role, Midtrans Server Key) hanya di server. Tidak ada di `NEXT_PUBLIC_*`.
- `order_code` unik & mudah dibaca; pakai juga sebagai `order_id` Midtrans (unik per transaksi). Jika order yang sama perlu QR ulang, gunakan order_id baru atau ikuti aturan Midtrans tentang order_id unik.
- Webhook idempotent: jika order sudah `paid`/`completed`, abaikan notifikasi duplikat.
- QR kadaluarsa (default 15 menit Midtrans). Tangani status `expire`.
- Validasi `gross_amount` == subtotal+pajak == jumlah `item_details` (termasuk baris pajak).
- Pembulatan rupiah: total integer, hindari desimal.
- RLS aktif sebelum go-live; jangan biarkan tabel terbuka penuh ke anon.
