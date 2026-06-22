# CONTEXT.md — State Pembangunan

> Diupdate tiap iterasi. Sumber kebenaran fitur = `CLAUDE.md`. Log keputusan = `DECISIONS.md`.

**Overview:** Sistem ordering Nasi Padang Ajo Datuak — monorepo 2 app web (customer + admin), 1 DB Supabase, pembayaran QRIS via Midtrans Sandbox.

---

## Checklist Build (WAJIB — CLAUDE.md §11)

- [x] **Iterasi 0** — Skeleton monorepo (struktur, tema cream/brown, env.example, docs). ✅
- [x] **1. Setup Supabase** — skema §8, seed menu §8.4, Realtime, RLS §8.6. **(SQL sudah dijalankan & terverifikasi.)** ✅
- [x] **2. Customer – Menu & Cart** — 4 kategori, card tanpa deskripsi, detail item (qty+note), cart bar sticky. ✅
- [x] **3. Customer – Checkout** — input meja, ringkasan editable, pajak PB1 10%, total. ✅
- [x] **4. Backend – `/api/checkout`** — insert orders + order_items (service role) + charge Midtrans QRIS + simpan data QR. ✅
- [x] **5. Customer – Halaman QRIS** (`/pay/[orderId]`) — render QR dari `qris_string`, listen status via polling route server. ✅
- [x] **6. Webhook Midtrans** (`/api/midtrans/webhook` di admin) — verifikasi signature, update `paid`, idempotent. ✅ *(perlu uji E2E lokal via ngrok + Notification URL)*
- [x] **7. Customer – Halaman Sukses** (`/success`) — auto-redirect saat `paid`, kartu ringkasan order. ✅
- [x] **8. Admin – Login + Dashboard Pesanan** — Supabase Auth, realtime list, "Tandai Selesai" untuk order apa pun (tidak harus `paid` — keputusan 2026-06-22). ✅
- [x] **9. Admin – Laporan Keuangan** — tabel transaksi + ringkasan pendapatan, filter Hari Ini/Semua. ✅
- [x] **10. Polish tema + edge cases** — empty/error states, expiry+pesan ulang, loading, invariant guard, idempotency re-verified. ✅
- [~] **11. Deploy** — config Vercel siap + runbook `DEPLOY.md` ditulis & build lulus. **Eksekusi deploy = manual oleh pemilik** (butuh akun Vercel/Supabase/Midtrans). ← tinggal jalankan runbook

> 🎉 **Semua fitur WAJIB (1–9) selesai & build lulus.** Polish (10) selesai. Deploy (11): persiapan & runbook beres; tinggal eksekusi manual, lalu [OPTIONAL].

---

## Current State (Iterasi 0 — selesai)

- Monorepo npm workspaces: `apps/*` + `packages/*`.
- `apps/customer` — Next.js 15 (App Router) + TS + Tailwind v3, mobile-first. Port **3000**. Placeholder home bertema.
- `apps/admin` — Next.js 15 (App Router) + TS + Tailwind v3, tablet. Port **3001**. Placeholder home bertema.
- `packages/shared` — paket TS stub: `types.ts`, `money.ts`, `constants.ts`, `index.ts` (semua TODO). Alias `@ajo/shared`, di-transpile via `transpilePackages`.
- Tema cream → brown (hex persis CLAUDE.md §9) di-extend pada Tailwind config kedua app. Font: **Plus Jakarta Sans** (`next/font/google`, variabel `--font-jakarta`).
- `.env.example` di root + per app (semua var §7.4, placeholder, tanpa secret).
- `.gitignore` mengabaikan `.env*` (kecuali `.env.example`), `node_modules`, `.next`, `build/`, `out/`, `dist/`.
- Verifikasi: `npm run build` **lulus** untuk kedua app.

**Belum ada (saat iterasi 0):** menu/cart, Midtrans, webhook, auth.

## Iterasi 1 — Database (selesai — SQL sudah dijalankan)

- `supabase/schema.sql` — 3 tabel (§8), seed 16 menu (§5.1, semua Rp 15.000), RLS (§8.6), Realtime untuk `orders` + `order_items`.
- `supabase/README.md` — langkah manual: paste SQL, verifikasi Realtime/RLS, salin kunci ke `.env.local`.
- `packages/shared` terisi: `types.ts` (Order/OrderItem/MenuItem + union status/kategori), `constants.ts` (enum status + kategori, DEFAULT_PRICE, ORDER_CODE_PREFIX), `money.ts` (`formatRupiah`, `calcTax`, `calcTotal`, `calcOrderAmounts`). Typecheck lulus.
- **Keputusan 2026-06-22 (final):** "Tandai Selesai" admin **tidak lagi** mensyaratkan status `paid` — bisa dari status mana pun. RLS: `using (true)` + `with check (status='completed')` (admin tetap tak bisa set `paid`). CLAUDE.md §6.1/§8.6/§12 sudah diperbarui. Detail di DECISIONS.md.

## Iterasi 2 — Customer Menu, Detail, Cart (selesai)

Hanya di `apps/customer`. Diverifikasi via `npm run build` + smoke test dev (semua route 200, menu menarik 16 item dari Supabase).

- **Menu** (`app/page.tsx`) — server component, fetch `menu_items` (anon read, `is_available=true`, urut `sort_order`→`name`), dikelompokkan 4 kategori (urutan `MENU_CATEGORIES`). Card foto + nama + `Rp 15.000`, TANPA deskripsi. Nomor meja dari `?table=NN` ditampilkan di header. Empty/error state bila Supabase belum siap.
- **Detail item** (`app/item/[id]/page.tsx`) — generik untuk semua id; fetch item by id (→ `notFound()` bila tak ada). Foto placeholder + nama + harga (accent) + `AddToCartForm`.
- **Cart** — React Context (`lib/cart.tsx`), **memori saja, tanpa localStorage**. Baris digabung bila `id`+`note` sama. Provider dipasang di `app/layout.tsx`.
- **Cart bar sticky** (`components/CartBar.tsx`) — muncul bila ≥1 item; tampil `N item · subtotal`; tombol "Lihat Keranjang" → `/checkout`.
- **Checkout** (`app/checkout/page.tsx`) — **STUB**: hanya daftar isi keranjang (qty +/−, hapus). TANPA rincian biaya/pembayaran (iterasi berikutnya).
- Komponen reusable: `MenuCard`, `FoodImage`, `QuantitySelector`, `AddToCartForm`, `TableInitializer`, `icons` (SVG inline). Supabase anon client di `lib/supabase.ts`. Dependensi baru: `@supabase/supabase-js`.
- ⚠️ **Foto placeholder** — gambar makanan ASLI belum ada; `FoodImage` menampilkan kotak cream/tan + ikon. Ganti dengan foto asli nanti (kolom foto belum ada di skema).

**Belum dikerjakan (sesuai scope):** rincian biaya (subtotal/pajak/total) & input meja final di checkout, `/api/checkout` + Midtrans, halaman QRIS/sukses, seluruh app admin.

---

## Iterasi 3 — Checkout + pembuatan order (selesai)

Hanya di `apps/customer`. Diverifikasi via `npm run build` + smoke test (order pending dibuat, total = subtotal+PB1, pay stub membaca order).

- **Checkout** (`app/checkout/page.tsx`) — versi penuh: input **Nomor Meja** wajib & numerik (pre-fill dari `cart.table` / `?table=NN`, tetap editable, hanya digit), daftar item (qty ± & hapus), kartu rincian **Subtotal + Pajak Restoran (10%) + Total** via `calcOrderAmounts` (@ajo/shared), tombol **"Pesan & Bayar"** (disabled bila meja kosong/submit). useSearchParams dibungkus `<Suspense>`. Sukses → `clear()` cart → redirect `/pay/[id]`.
- **Route** (`app/api/checkout/route.ts`, POST, runtime nodejs) — terima `{ table_number, items:[{id,quantity,note}] }`. **Tidak percaya harga/total client**: ambil `name`+`price` authoritative dari `menu_items` by id, hitung ulang subtotal/tax/total via `calcOrderAmounts`. Generate `order_code` `AJD-YYYYMMDD-NNNN` (WIB, sequence by count + retry pada bentrok unique). Insert `orders` (status **`pending`** — tak pernah dari client) + `order_items` (snapshot nama+harga) via **service role**. Cleanup order yatim bila insert item gagal. Balikkan `{id, order_code, total}` (201). Validasi → 400; item tak tersedia → 409.
- **Pay stub** (`app/pay/[orderId]/page.tsx`) — baca order **server-side via service role** (anon tak boleh baca `orders`, §8.6). Tampil order_code, meja, total, status, placeholder "QR akan muncul di sini". QRIS asli + listen status = iterasi berikutnya.
- **Client baru** (`lib/supabase-admin.ts`) — service role client, dilindungi `import "server-only"`; key dari `SUPABASE_SERVICE_ROLE_KEY` (tanpa `NEXT_PUBLIC_`, tak terekspos). Tidak ada env var baru (sudah ada di `.env.example`).

**Belum dikerjakan:** Midtrans charge (`/v2/charge`) + render QR asli di pay page, webhook (app admin), listen status realtime/polling → halaman sukses, seluruh app admin.

---

## Iterasi 4 — Midtrans QRIS charge (selesai)

Hanya di `apps/customer`. Build lulus. Charge + render QR + listen status. **Webhook (penulis `paid`) = iterasi berikutnya di apps/admin.**

- **Migration DB** (`supabase/migration_iter4_midtrans.sql`) — tambah 3 kolom ke `orders`: `qris_string`, `qris_url`, `qris_expiry` (semua text). `schema.sql` ikut diperbarui. **Harus dijalankan di Supabase SQL Editor sebelum tes.**
- **`lib/midtrans.ts`** — `chargeQris()` server-only. POST `/v2/charge` (Sandbox bila `MIDTRANS_IS_PRODUCTION!="true"`), auth Basic `base64(SERVER_KEY:)`. Body `payment_type:"qris"`, `transaction_details{order_id, gross_amount}`, `item_details`, `qris{acquirer:"gopay"}`. Balikkan `transactionId, paymentType, qrString, qrImageUrl, expiryTime, transactionStatus`.
- **`/api/checkout`** — setelah insert order+items, susun `item_details` (baris menu + 1 baris pajak `id:"tax"` agar Σ == `gross_amount`=total), panggil `chargeQris(orderId=order_code, grossAmount=total, items)`. Simpan `midtrans_transaction_id, payment_type, qris_string, qris_url, qris_expiry` ke order. Charge gagal → hapus order+item, balikkan **502**.
- **`/api/orders/[id]/status`** (GET, service role, **READ-ONLY**) — balikkan `{status}`. Tidak pernah menulis `paid` (eksklusif webhook, §4). Dipakai customer karena anon tak boleh SELECT `orders` (§8.6).
- **`/pay/[orderId]`** — RSC baca order via service role, render QR dari `qris_string` jadi data URL via `qrcode` (fallback ke `qris_url`). Mount `PaymentStatusWatcher` (client) — polling status tiap 4 dtk; saat `paid`/`completed` → redirect `/success`; countdown dari `qris_expiry` (WIB +07:00). Link ke Midtrans Simulator.
- **Dependensi baru:** `qrcode` + `@types/qrcode`.

**Belum dikerjakan:** webhook Midtrans (apps/admin) yang verifikasi signature & set `paid` (idempotent); halaman `/success` (step 7); seluruh app admin.

---

## Iterasi 5 — Webhook Midtrans (selesai — perlu uji E2E lokal)

Hanya di `apps/admin`. Build lulus. **Satu-satunya jalur yang menulis `paid`** (CLAUDE.md §4).

- **`apps/admin/lib/supabase-admin.ts`** — service-role client (`import "server-only"`), pola sama dengan customer.
- **`apps/admin/app/api/midtrans/webhook/route.ts`** (POST, runtime nodejs) —
  1. **Verifikasi signature** `sha512(order_id + status_code + gross_amount + ServerKey)` == `signature_key`, perbandingan **timing-safe** (`crypto.timingSafeEqual`). `gross_amount` dipakai sebagai STRING mentah dari payload (mis. "49500.00") — tidak diformat ulang. Tidak cocok → **403**.
  2. **Pemetaan status:** `settlement` atau (`capture` + `fraud_status=accept`) → `paid` (set `paid_at`, `payment_type`, `midtrans_transaction_id`); `expire` → `expired`; `cancel`/`deny` → `cancelled`; `pending`/lainnya → no-op.
  3. **Idempotent:** order ber-status final (`paid`/`completed`) tidak diubah lagi; update memakai guard `.not("status","in","(paid,completed)")` (aman terhadap notifikasi duplikat/race).
  4. **Selalu balas 200** untuk notifikasi bertanda-tangan valid (order tak ditemukan pun 200 agar Midtrans berhenti retry). Ada `GET` kecil untuk cek reachability via browser.
- Cocokkan order via `order_code` (= `order_id` Midtrans).
- **`apps/admin/.env.example`** sudah memuat `MIDTRANS_SERVER_KEY` + `SUPABASE_SERVICE_ROLE_KEY`; placeholder diperbaiki ke awalan `Mid-server-` (sesuai key Sandbox nyata). Dependensi baru: `@supabase/supabase-js`.
- **Catatan:** server key webhook HARUS sama dengan yang dipakai charge di customer (signature diverifikasi dengan key itu).

**Belum diuji:** E2E lokal (perlu ngrok + set Notification URL di Midtrans). Lihat instruksi di pesan iterasi ini.

---

## Iterasi 6 — Halaman Sukses customer (selesai)

Hanya di `apps/customer`. Build lulus. **Alur customer kini lengkap: menu → detail → cart → checkout → QRIS → paid → success.**

- **`app/success/page.tsx`** (RSC) — baca id order dari query `?order=<uuid>` (dibawa `PaymentStatusWatcher` saat redirect). Fetch order **read-only via service role** (`order_code`, `table_number`, `total`). Tampil: centang hijau lembut (`CheckCircleIcon`), heading **"Pembayaran Berhasil"**, pesan "Pesanan kamu sedang disiapkan.", kartu ringkasan (nomor pesanan, meja, total), tombol **"Pesan Lagi"**. Bila id tak ada/tak ketemu → tetap tampil sukses tanpa kartu (graceful).
- **`components/OrderAgainButton.tsx`** (client) — `clear()` cart + `router.push("/")`. Outline brown sesuai tema.
- **`PaymentStatusWatcher`** diperbarui: redirect ke `/success?order=${orderId}` (sebelumnya tanpa id).
- **Refresh `/pay` setelah bayar:** ditangani — pay page render dengan `initialStatus='paid'`, watcher melewati polling & langsung redirect ke success.

---

## Iterasi 7 — Admin: Login + Dashboard Pesanan (selesai)

Hanya di `apps/admin`. Build lulus.

- **`lib/supabase-browser.ts`** — client anon BROWSER (singleton): Supabase Auth (sesi di localStorage), baca orders/order_items (RLS authenticated), Realtime, UPDATE → `completed`. Tanpa service role di browser.
- **`app/login/page.tsx`** (client) — `signInWithPassword` (email+password, 1 akun shared, tanpa role tier). Sudah login → redirect `/orders`. Error → "Email atau kata sandi salah."
- **`app/(protected)/layout.tsx`** (client) — gate auth: `getSession` + `onAuthStateChange`; belum login → `/login`. Header: nama warung, email, tombol **Keluar** (`signOut`). Proteksi sisi-klien cukup karena DATA dijaga RLS (anon tak bisa baca orders).
- **`app/(protected)/orders/page.tsx`** (client) — fetch `orders` + nested `order_items` (terbaru di atas), **Realtime** subscribe perubahan `orders`+`order_items` → refetch (panggil `realtime.setAuth(token)` agar RLS lolos). Kartu: order_code, meja, daftar item (qty×nama + note), total, badge **Sudah/Belum Dibayar** (berdasar `paid_at`), badge penyajian (Diproses/Selesai/Kedaluwarsa/Dibatalkan), waktu (WIB). Filter **Aktif** (pending/paid) / **Riwayat** (completed/expired/cancelled). Tombol **"Tandai Selesai"** untuk order pending/paid → `update {status:'completed', completed_at}`. Order `completed` → state "✓ Selesai".
- **`app/page.tsx`** — `redirect("/orders")`.
- **Enforcement:** UPDATE dari browser lewat RLS `orders_update_complete_admin` (`using(true)`, `with check(status='completed')`). Set `paid` dari klien DITOLAK RLS — admin tetap tak bisa men-set `paid` (eksklusif webhook).

**Belum dikerjakan:** Laporan Keuangan (`/reports`), polish tema akhir, deploy.

---

## Iterasi 8 — Admin: Laporan Keuangan (selesai)

Hanya di `apps/admin`. Build lulus. **Semua fitur WAJIB kini lengkap.**

- **`app/(protected)/reports/page.tsx`** (client) — fetch `orders` + nested `order_items` (sekali saat mount). **3 kartu ringkasan:** Total Pendapatan (Σ `total` untuk status `paid`/`completed`), Jumlah Pesanan (semua baris dalam filter), Pesanan Selesai (count `completed`). **Filter tanggal** Hari Ini / Semua (basis WIB, client-side via `jakartaDate`). **Tabel:** No. Pesanan, Waktu (WIB), Meja, Item (ringkas `qty× nama`, dipisah koma), Subtotal, Pajak, Total, Status (badge). Reuse `formatRupiah` (@ajo/shared). Empty/error state.
- **`app/(protected)/layout.tsx`** — header diberi **nav** Pesanan / Laporan (highlight aktif via `usePathname`).
- Statistik & tabel menghormati filter tanggal; Total Pendapatan hanya menjumlah `paid`/`completed` (pesanan `pending`/`expired`/`cancelled` tetap tampil di tabel tapi tak dihitung sebagai pendapatan).

**Belum dikerjakan:** polish tema akhir (sebagian sudah), deploy ke Vercel (2 project, env, Notification URL produksi), lalu fitur [OPTIONAL].

---

## Iterasi 9 — Polish + edge cases (selesai)

Hardening, tanpa fitur baru. Build kedua app lulus.

- **Invariant pembayaran (§13):** `/api/checkout` kini punya guard runtime `Σ(item_details termasuk pajak) === total (gross_amount)` SEBELUM charge; bila tak cocok → hapus order + 500. Mencegah charge yang pasti ditolak Midtrans & order menggantung.
- **QR expiry + pesan ulang:** `PaymentStatusWatcher` menampilkan tombol **"Pesan Lagi"** saat status `expired`/`cancelled` ATAU countdown lokal habis (QR kemungkinan mati). Sebelumnya hanya teks tanpa jalan keluar.
- **Loading:** `apps/customer/app/loading.tsx` (spinner) untuk transisi route yang fetch. Admin sudah punya spinner (login, layout gate, orders, reports).
- **Idempotency webhook — diverifikasi ulang:** duplikat `settlement` pada order `paid`/`completed` short-circuit (200, tanpa tulis); UPDATE diberi guard `.not("status","in","(paid,completed)")` untuk race. Aman.
- **Empty/error states — diverifikasi:** menu (gagal muat / kosong), keranjang kosong, dashboard (aktif/riwayat kosong), laporan (kosong per filter), checkout (gagal/network), charge gagal (502 → pesan), pay (order tak ada → 404). Semua on-brand cream/brown.
- **Responsif:** customer mobile-first (`max-w-[480px]`); admin tablet (`max-w-6xl`, grid 2 kolom pesanan, tabel `overflow-x-auto`).
- **Secrets/gitignore:** repo git aktif; HANYA `*.env.example` (placeholder) yang tracked. `.gitignore` mengabaikan `.env*` kecuali `.env.example`. Tak ada secret ter-commit.

**Risiko/ditunda → [OPTIONAL]:** lihat DECISIONS.md (auth flash sisi-klien, polling vs realtime customer, foto menu placeholder, dll).

---

## Iterasi 10 — Persiapan Deploy + Runbook (selesai; eksekusi manual)

Tanpa fitur baru. Build kedua app lulus dengan config baru.

- **`outputFileTracingRoot`** ditambah ke `apps/customer/next.config.mjs` & `apps/admin/next.config.mjs` → menunjuk root monorepo (`../../`). Saat Root Directory di Vercel di-set per-app, ini memastikan Next melacak file workspace (`@ajo/shared`) dengan benar & tak salah menebak tracing root. Tak ada `vercel.json` (tak perlu).
- **`DEPLOY.md`** — runbook lengkap step-by-step: push GitHub, buat 2 project Vercel (Root Directory `apps/customer` & `apps/admin`), env vars per project (peta ke CLAUDE.md §7.4, tandai service role + Midtrans server key SERVER-ONLY, server key WAJIB sama di kedua project), set Notification URL Midtrans ke webhook admin produksi, smoke test E2E produksi, jaga Supabase free tier aktif.
- **Belum dieksekusi:** deploy aktual butuh akun Vercel/Supabase/Midtrans pemilik → dijalankan manual mengikuti `DEPLOY.md`. URL belum live sampai runbook dijalankan.

---

## Iterasi 11 — Foto menu (selesai)

Hanya di `apps/customer` + DB. Build kedua app lulus.

- **Foto dipindah ke tempatnya:** folder asli `menu-ajo-datuak/` (di root) dihapus; 17 foto disalin ke **`apps/customer/public/menu/`** dengan nama web-safe (kebab-case, mis. `rendang.jpg`, `ayam-sambal-ijo.jpg`).
- **Kolom DB baru `menu_items.image_url`** (text, nullable). `schema.sql` diperbarui (kolom + seed lengkap dgn foto & item baru). Migration `supabase/migration_iter11_menu_images.sql` untuk DB yang SUDAH terisi (add column + update foto item lama by name + insert item baru bila nama belum ada; idempotent). **Harus dijalankan di Supabase SQL Editor.**
- **Tipe `MenuItem`** (@ajo/shared) ditambah `image_url: string | null`.
- **`FoodImage`** kini render foto asli via `next/image` (`fill` + `object-cover` + `sizes`, otomatis dioptimasi) bila `image_url` ada; fallback placeholder cream/tan + ikon bila `null`. `MenuCard` & detail item (`/item/[id]`) meneruskan `item.image_url`.
- **Pemetaan foto** (semua **Lauk** kecuali Paket):
  - Item LAMA dapat foto: Paket Mahasiswa, Rendang, Tahu (`tahu-goreng`), Lele (`ikan-lele-goreng`), Telor Dadar, Ayam Cabe Ijo (`ayam-sambal-ijo`), Ayam Balado.
  - Item BARU (foto ada, item belum ada): Ayam Bakar, Ayam Goreng, Ikan Balado, Ikan Goreng, Terong.
  - Item BARU nama BELUM PASTI (foto ada, perlu dikonfirmasi pemilik): "Ayam (perlu dicek)", "Menu (perlu dicek 1/2/3)" (Lauk), "Paket Mahasiswa 2 (perlu dicek)" (Paket). Ganti nama lewat DB: `update menu_items set name='...' where name='...'`.
  - Tetap PLACEHOLDER (belum ada foto): Ayam Gulai, Nasi, Nasi Rames, semua Minuman.
- ⚠️ Foto sumber ~3MB/file (besar); `next/image` mengoptimasi saat request (aman build). Bila perlu, kompres foto sumber nanti (OPTIONAL).

---

## Iterasi 12 — Logo brand (selesai)

Hanya di `apps/*` (aset + header). Build kedua app lulus.

- **Logo dipindah ke tempatnya:** 2 file dari root (`logo-light.png`, `logo-dark.png`, 2000×2000, latar transparan) disalin ke **`apps/customer/public/`** DAN **`apps/admin/public/`** (tiap app = deployment terpisah, butuh salinannya sendiri). File asli di root dihapus.
- **Konvensi varian:** `logo-dark.png` (warna gelap) untuk latar TERANG; `logo-light.png` (warna terang/peach) untuk latar GELAP. Semua penempatan saat ini ada di latar terang → pakai `logo-dark.png`. `logo-light.png` disimpan untuk kebutuhan latar gelap nanti.
- **Penggantian placeholder/akronim "AD":**
  - **Customer** ([app/page.tsx](apps/customer/app/page.tsx)) — lingkaran `AD` di header diganti `logo-dark.png` (`next/image`, h-11) + teks "Nasi Padang Ajo Datuak" dipertahankan.
  - **Admin header** ([(protected)/layout.tsx](apps/admin/app/(protected)/layout.tsx)) — teks "Ajo Datuak" diganti `logo-dark.png` (h-9) + badge "Admin" dipertahankan.
  - **Admin login** ([login/page.tsx](apps/admin/app/login/page.tsx)) — `logo-dark.png` besar (h-28, wordmark terbaca) menggantikan judul "Ajo Datuak"; eyebrow "Admin" + subjudul dipertahankan.
- Logo dirender via `next/image` (`object-contain`, `priority`) — dioptimasi otomatis. Belum mengganti favicon/tab icon (default Next) — bisa ditambah nanti via `app/icon.png` (OPTIONAL; perlu pertimbangkan kontras tab mode gelap).

---

## Next

1. **Jalankan `supabase/migration_iter11_menu_images.sql`** di Supabase SQL Editor (agar foto & item baru muncul pada DB yang sudah terisi).
2. **Eksekusi `DEPLOY.md`** (manual, oleh pemilik). Foto di `public/menu/` ikut ter-deploy bersama app customer.
3. Setelah live & smoke test lulus → fitur **[OPTIONAL]** (CLAUDE.md §11): role tier, harga per item + editor menu, notifikasi suara, print struk, toggle sold-out, export CSV, QR statis per meja.

---

## How to Run

Install sekali dari root (workspaces):

```bash
npm install
```

Jalankan tiap app (terminal terpisah):

```bash
# Customer → http://localhost:3000
npm run dev:customer

# Admin → http://localhost:3001
npm run dev:admin
```

Build / cek kompilasi:

```bash
npm run build:customer
npm run build:admin
```

> Sebelum menjalankan fitur DB/Midtrans (iterasi 1+), salin `.env.example` → `.env.local` di tiap app dan isi nilainya.
