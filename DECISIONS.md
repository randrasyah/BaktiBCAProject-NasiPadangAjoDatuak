# DECISIONS.md — Log Keputusan Teknis

> Format: `YYYY-MM-DD — Keputusan — Rationale`. Append tiap iterasi. Tidak menimpa entri lama.

## Iterasi 0 — Skeleton

- **2026-06-22 — Monorepo (1 repo) alih-alih 2 repo terpisah.** — Customer & admin berbagi skema DB, tipe, util (pajak/format rupiah), dan dokumen sumber kebenaran (CLAUDE.md/CONTEXT.md/DECISIONS.md). Satu tempat menjaga konsistensi enum status & perhitungan. Tetap dua deployment independen: tiap app di-deploy sebagai project Vercel terpisah lewat setelan **Root Directory** (`apps/customer` / `apps/admin`) — jadi tidak kehilangan isolasi deploy. (CLAUDE.md §10.)

- **2026-06-22 — npm workspaces untuk mengelola monorepo.** — Bawaan npm (sudah ada, tanpa tool tambahan seperti pnpm/turbo), cukup untuk 2 app + 1 paket shared. Dependency di-hoist ke root, install sekali. Bisa di-upgrade ke turborepo nanti bila perlu caching build.

- **2026-06-22 — Stack: Next.js 15 (App Router) + TypeScript + Tailwind CSS.** — Sesuai CLAUDE.md §3. App Router untuk Route Handlers (`/api/checkout`, `/api/midtrans/webhook`) yang menjalankan logika server-side tepercaya (service role, charge Midtrans, verifikasi signature) tanpa server terpisah. Deploy mulus ke Vercel.

- **2026-06-22 — Tailwind v3 (bukan v4) dengan `tailwind.config.ts`.** — CLAUDE.md §9 meminta token tema di-*extend* lewat config; pendekatan config-file v3 lebih lugas & stabil untuk itu dibanding tema berbasis CSS di v4. Token warna cream→brown didefinisikan dengan hex persis di kedua app.

- **2026-06-22 — Font: Plus Jakarta Sans (via `next/font/google`).** — Salah satu dari dua opsi di CLAUDE.md §9; karakter geometrik-humanis yang hangat & bersih, cocok dengan mood cream/brown dan keterbacaan mobile. Di-wire sebagai CSS variable `--font-jakarta` → `fontFamily.sans` Tailwind, self-hosted otomatis oleh Next (tanpa request runtime ke Google).

- **2026-06-22 — Paket shared diekspos sebagai source TS (`@ajo/shared`) + `transpilePackages`.** — Tanpa langkah build terpisah untuk paket internal; Next mentranspile sumbernya langsung. Sederhana untuk skala ini.

- **2026-06-22 — Port dev tetap: customer 3000, admin 3001.** — Agar kedua app bisa jalan bersamaan saat dev tanpa bentrok port.

## Iterasi 1 — Database

- **2026-06-22 — RLS: andalkan bypass service_role, bukan policy insert/paid.** — `service_role` (dipakai `/api/checkout` & webhook) melewati RLS, jadi sengaja TIDAK ada policy INSERT order maupun set `paid` untuk anon/authenticated. Hasilnya frontend tidak akan pernah bisa menulis `paid` (sesuai CLAUDE.md §4). anon hanya punya policy SELECT pada `menu_items`.

- **2026-06-22 — Tipe waktu sebagai `string` (ISO) & kolom nullable `| null` di `packages/shared`.** — Mirror payload Supabase JS: `timestamptz` datang sebagai string ISO; kolom opsional (`paid_at`, `payment_type`, `completed_at`, `menu_item_id`, `note`) bisa `null`. Union `OrderStatus`/`MenuCategory` diturunkan dari tuple `as const` di `constants.ts` agar selalu sinkron dengan CHECK di DB.

- **2026-06-22 — Pembulatan pajak: `Math.round(subtotal * 0.10)`, semua rupiah integer.** — PB1 10% dibulatkan ke rupiah penuh; `total = subtotal + tax` (= `gross_amount` Midtrans). Tidak ada desimal (CLAUDE.md §5.2, §13).

- **2026-06-22 — [PERUBAHAN ATURAN] "Tandai Selesai" tidak lagi mensyaratkan `paid` (keputusan pemilik).** — Sebelumnya admin hanya boleh menyelesaikan order ber-status `paid`. Disederhanakan: admin boleh menandai `completed` dari status mana pun. RLS diubah dari `using (status = 'paid')` menjadi `using (true)`, `with check (status = 'completed')` tetap dipertahankan sehingga admin **tetap tidak bisa** men-set `paid` (eksklusif webhook). CLAUDE.md §6.1, §8.6, §12 ikut diperbarui. **Keputusan final — stick to this.** Konsekuensi diterima: order bisa ditandai selesai walau belum terbayar.

## Iterasi 2 — Customer Menu, Detail, Cart

- **2026-06-22 — Keranjang pakai React Context di memori, TANPA localStorage.** — Sesuai catatan iterasi. State hidup selama sesi SPA; reset saat reload penuh — dapat diterima untuk alur scan-QR sekali pesan. Provider dipasang di `app/layout.tsx`. Tidak over-engineer (tanpa reducer/persist lib).

- **2026-06-22 — Baris keranjang digabung berdasarkan `id` + `note` (key `${id}__${note}`).** — Item sama dengan catatan sama menambah qty; catatan berbeda = baris terpisah (mis. "tanpa kuah" vs "sambal dipisah"), cocok dengan referensi visual Keranjang.

- **2026-06-22 — Menu & detail = Server Component yang fetch langsung dari Supabase (anon key), bukan client fetch.** — Render awal berisi data (baik untuk first paint & nantinya SEO), anon key aman diekspos. Bagian interaktif (card klik, qty, note, cart bar) dipecah jadi Client Component kecil. `export const dynamic = "force-dynamic"` agar menu selalu fresh.

- **2026-06-22 — Pakai token tema iterasi-0 (`cream/tan/brown/accent`), bukan token Stitch.** — Output Stitch hanya acuan VISUAL. Token Stitch (`surface-white`, `primary-container`, dst.) tidak diadopsi; semua kelas memakai palet CLAUDE.md §9 yang sudah ada di `tailwind.config.ts`. Hex praktis identik.

- **2026-06-22 — Deskripsi & badge "Premium" dari mockup Stitch DIBUANG di detail item.** — CLAUDE.md §5.1 "TIDAK ADA deskripsi" dan skema `menu_items` tak punya kolom deskripsi. Detail hanya: foto, nama, harga, qty, catatan.

- **2026-06-22 — Foto = placeholder CSS (`FoodImage`), bukan hotlink gambar Stitch.** — URL `googleusercontent` di mockup bersifat sementara/eksternal. Placeholder lokal (kotak cream→tan + ikon SVG) lebih andal & jelas sementara. Foto asli menyusul; skema belum punya kolom foto.

- **2026-06-22 — Ikon = SVG inline (`components/icons.tsx`), bukan font Material Symbols.** — Mockup pakai Material Symbols; menambah font ikon = beban & dependensi. SVG inline ringan, mengikuti `currentColor`.

- **2026-06-22 — Nomor meja `?table=NN` disimpan ke cart context via `TableInitializer`.** — Selain ditampilkan di header menu, di-set ke context agar checkout (iterasi 3) bisa pre-fill. Komponen kecil tanpa render.

## Iterasi 3 — Checkout + pembuatan order

- **2026-06-22 — Server MENGHITUNG ULANG harga & total, tidak percaya client.** — `/api/checkout` hanya menerima `{id, quantity, note}`; `name`+`price` diambil authoritative dari `menu_items` (by id), subtotal/tax/total dihitung ulang via `calcOrderAmounts` (@ajo/shared). Client boleh menampilkan estimasi, tapi yang disimpan & (nanti) dikirim ke Midtrans = hitungan server. Mencegah manipulasi harga (CLAUDE.md §13).

- **2026-06-22 — `order_code` = `AJD-YYYYMMDD-NNNN`, tanggal WIB, NNNN urut harian.** — Tanggal pakai `Asia/Jakarta`. Sequence = jumlah order dengan prefix tanggal yang sama + 1, di-`padStart(4,'0')`. Tabrakan (race) ditangani retry pada `unique_violation` (Postgres `23505`) hingga 10x dengan menaikkan nomor. Cukup untuk skala warung; `order_code` punya constraint UNIQUE sebagai pengaman akhir.

- **2026-06-22 — Status order SELALU `pending` dari route ini; tak ada jalur set status dari client.** — Sesuai CLAUDE.md §4/§8.6. `paid` hanya via webhook (service role), `completed` hanya via admin. Frontend hanya membaca.

- **2026-06-22 — Insert via service-role client (`lib/supabase-admin.ts`) dijaga `import "server-only"`.** — Build gagal bila ter-bundle ke client. Key dari `SUPABASE_SERVICE_ROLE_KEY` (tanpa `NEXT_PUBLIC_`). Tanpa transaksi lintas-tabel di supabase-js: bila insert `order_items` gagal, order yatim dihapus (best-effort) agar tak ada order tanpa item.

- **2026-06-22 — Halaman `/pay/[orderId]` membaca order via service role (RSC), bukan anon.** — anon tak punya policy SELECT pada `orders` (§8.6). Karena server component, baca pakai service role aman; `orderId` = UUID (tak bisa ditebak). Ini mengimplementasikan opsi "via route server" dari keputusan iterasi 1.

- **2026-06-22 — `useSearchParams` di checkout dibungkus `<Suspense>`.** — Wajib di Next 15 agar build tidak gagal; checkout dibagi jadi wrapper (`CheckoutPage`) + `CheckoutForm`.

- **2026-06-22 — Cart di-`clear()` setelah order sukses dibuat, sebelum redirect ke `/pay`.** — Order `pending` sudah tercatat di DB; mengosongkan keranjang mencegah submit ganda / order duplikat.

## Iterasi 4 — Midtrans QRIS charge

- **2026-06-22 — Charge Midtrans dilakukan DI DALAM `/api/checkout`, bukan route terpisah.** — Order + charge atomik dari sudut pandang client (1 request → balik `id`). Bila charge gagal, order + item yang baru di-insert DIHAPUS (502) supaya tak ada order menggantung tanpa QR. Trade-off: charge lambat menahan response checkout; dapat diterima untuk skala warung. (CLAUDE.md §4 langkah 2–3.)

- **2026-06-22 — Data QRIS di-PERSIST ke `orders` (kolom baru `qris_string`/`qris_url`/`qris_expiry`), bukan re-fetch ke Midtrans tiap buka `/pay`.** — Halaman pembayaran (RSC) cukup baca DB; tak ada panggilan Midtrans berulang / tak bocorkan server key ke jalur baca. Skema `orders` di CLAUDE.md §8.2 tak punya kolom QR → ditambah via `supabase/migration_iter4_midtrans.sql` (3 kolom text, `add column if not exists`). CLAUDE.md TIDAK diubah; ini ekstensi DB pendukung, bukan perubahan keputusan. `qris_expiry` disimpan sebagai TEXT (string mentah WIB Midtrans) untuk hindari ambiguitas timezone saat parse di client (`+07:00`).

- **2026-06-22 — QR di-render dari `qris_string` jadi data URL via lib `qrcode` di SERVER (RSC), bukan hotlink gambar Midtrans.** — Tak bergantung pada ketersediaan/host gambar Midtrans; tampil instan, warna mengikuti tema (dark `#3E2A20`). `qris_url` disimpan sebagai fallback bila `qris_string` kosong. Dependensi baru `qrcode` + `@types/qrcode` (apps/customer).

- **2026-06-22 — Listen status via POLLING route server (`/api/orders/[id]/status`, service role, read-only) tiap 4 dtk, BUKAN Supabase Realtime anon.** — anon sengaja tak punya policy SELECT `orders` (keputusan iterasi 1), jadi Realtime client anon takkan menerima baris. Polling lewat route server (service role) konsisten dengan §8.6 ("via route server"). Route ini **hanya membaca** — tak pernah menulis `paid` (eksklusif webhook, §4). `PaymentStatusWatcher` (client) redirect ke `/success` saat `paid`/`completed`.

- **2026-06-22 — `item_details` Midtrans = baris menu + 1 baris pajak `id:"tax"`.** — Σ(price×qty) seluruh baris WAJIB == `gross_amount` (= total = subtotal+pajak), kalau tidak Midtrans menolak. Pajak dimasukkan sebagai baris item tersendiri sesuai CLAUDE.md §7.1. `order_id` Midtrans = `order_code` (unik).

- **2026-06-22 — Redirect target saat lunas = `/success` (belum dibuat sampai step 7).** — Sesuai CLAUDE.md §5.3. Sampai halaman sukses dibangun, redirect akan 404; ini disengaja agar scope iterasi 4 tetap sempit (tak membangun `/success`). Listener tetap teruji (URL berubah).

## Iterasi 5 — Webhook Midtrans (apps/admin)

- **2026-06-22 — Signature diverifikasi dengan `crypto.timingSafeEqual`, bukan `===`.** — Cegah timing attack pada pembanding signature. Panjang dicek dulu (timingSafeEqual melempar bila beda panjang). `gross_amount` yang dihash adalah STRING MENTAH dari payload Midtrans (mis. "49500.00") — bila diformat ulang jadi integer, hash takkan cocok. Signature gagal → **403** (tolak; satu-satunya non-200 selain error server/parse).

- **2026-06-22 — Idempotensi via status final + guard query.** — Order ber-status `paid`/`completed` dianggap final: notifikasi `settlement` duplikat di-skip (balas 200, tak menulis ulang). Selain cek `status` hasil SELECT, UPDATE diberi filter `.not("status","in","(paid,completed)")` sebagai pengaman race (dua webhook tiba bersamaan). Notifikasi `expire`/`cancel`/`deny` juga TIDAK menurunkan order yang sudah `paid`/`completed`.

- **2026-06-22 — Selalu balas HTTP 200 untuk notifikasi valid (termasuk order tak ditemukan).** — Sesuai CLAUDE.md §7.3 ("selalu balas 200 cepat") agar Midtrans tidak retry berlebihan. Hanya signature tak valid (403), body non-JSON (400), server key hilang (500), atau error DB (500) yang non-200. Order tak ditemukan → 200 (no-op) karena order selalu dibuat sebelum charge, jadi 404 hanya akan memicu retry sia-sia.

- **2026-06-22 — Cocokkan order via `order_code` (= `order_id` Midtrans).** — `order_id` yang dikirim ke Midtrans saat charge = `order_code`, jadi webhook mencari `orders.order_code = payload.order_id`. Konsisten dengan keputusan iterasi 3/4.

- **2026-06-22 — Dev tunneling via ngrok; Notification URL di-set manual di dashboard Midtrans.** — Midtrans butuh URL publik untuk mengirim webhook; saat dev lokal, `ngrok http 3001` mengekspos app admin. Notification URL (Settings → Configuration) diarahkan ke `https://<ngrok>/api/midtrans/webhook`. Saat deploy, diganti ke domain admin produksi (CLAUDE.md §11 langkah 11). Server key admin WAJIB sama dengan yang dipakai charge di customer.

- **2026-06-22 — `@supabase/supabase-js` ditambahkan ke apps/admin + `lib/supabase-admin.ts` (service role).** — Webhook butuh tulis `paid` tanpa terhalang RLS; service role bypass RLS, dijaga `import "server-only"`.

## Iterasi 6 — Halaman Sukses customer

- **2026-06-22 — id order dibawa ke `/success` lewat query `?order=<uuid>`, bukan path param atau state.** — `PaymentStatusWatcher` redirect `router.replace('/success?order='+id)`. Alternatif `/success/[id]` ditolak agar `/success` tetap bisa dibuka tanpa id (graceful: tampil pesan sukses tanpa kartu). Order dibaca server-side via service role (anon tak boleh baca `orders`, §8.6), pola sama dengan `/pay`.

- **2026-06-22 — Success page = RSC + tombol "Pesan Lagi" sebagai Client Component kecil.** — Fetch order di server (read-only), interaktivitas (clear cart + navigasi) dipecah ke `OrderAgainButton` (`useCart`). Konsisten dengan pola iterasi 2 (server fetch + client islands).

- **2026-06-22 — Refresh `/pay` setelah lunas tetap mengarah ke `/success`.** — Pay page (RSC) membaca `status` terkini; `PaymentStatusWatcher` menerima `initialStatus`. Bila sudah `paid`/`completed`: polling dilewati, efek redirect langsung jalan. Tak perlu penanganan khusus tambahan.

- **2026-06-22 — Hijau sukses pakai `#6FA86A`/`#4f8a4a` (di luar palet cream/brown).** — CLAUDE.md §9 mengizinkan "hijau lembut untuk status sukses/selesai". Dipakai hanya pada centang & latar lingkarannya; sisanya tetap cream/brown.

## Iterasi 7 — Admin Login + Dashboard Pesanan

- **2026-06-22 — Auth pakai `@supabase/supabase-js` browser client (sesi localStorage), BUKAN `@supabase/ssr`/middleware.** — Dashboard wajib Client Component (Realtime websocket) sehingga gate auth sisi-klien natural. Menghindari dependensi + kompleksitas cookie SSR. DATA tetap aman: RLS hanya mengizinkan `authenticated` membaca `orders`/`order_items`; anon tak dapat apa-apa walau membuka URL. Flash UI dihindari dengan menahan render `(protected)/layout` sampai sesi terverifikasi (loader). 1 akun shared, tanpa role tier (CLAUDE.md §2.1/§6.0).

- **2026-06-22 — Proteksi route via Client Component `(protected)/layout.tsx`, bukan middleware.** — `getSession` + `onAuthStateChange`; belum login → `router.replace('/login')`. Konsisten dengan keputusan auth di atas. Root `/` → `redirect('/orders')` (RSC) lalu gate mengalihkan bila perlu.

- **2026-06-22 — Realtime: subscribe `postgres_changes` (orders + order_items) lalu REFETCH penuh, bukan patch state granular.** — Lebih sederhana & anti-bug ketimbang merekonsiliasi event INSERT/UPDATE/DELETE manual; volume warung kecil sehingga refetch murah. `supabase.realtime.setAuth(session.access_token)` dipanggil sebelum subscribe agar Realtime menghormati RLS (kalau tidak, baris `orders` tak terkirim ke `authenticated`).

- **2026-06-22 — Enforcement "completed" mengandalkan RLS iterasi 1, diverifikasi.** — UPDATE dari browser (authenticated) memakai policy `orders_update_complete_admin`: `using(true)` (boleh sentuh baris mana pun) + `with check(status='completed')` (hasil wajib `completed`). Klien set `{status:'completed', completed_at}` tanpa `.select()` (tak butuh RETURNING, jadi tak perlu policy SELECT untuk update). Mencoba set `paid` dari klien → ditolak `with check`. Jadi admin TIDAK PERNAH bisa men-set `paid` (eksklusif webhook). UI hanya menampilkan tombol untuk pending/paid; completed → state selesai.

- **2026-06-22 — Badge "Sudah/Belum Dibayar" berdasar `paid_at`, bukan `status`.** — Karena admin kini bisa menyelesaikan order yang BELUM dibayar (keputusan 2026-06-22), `status='completed'` tak menjamin terbayar. `paid_at` (di-set webhook) adalah indikator pembayaran yang akurat. Badge penyajian terpisah dari badge pembayaran.

## Iterasi 8 — Admin Laporan Keuangan

- **2026-06-22 — Total Pendapatan = Σ `total` untuk status `paid`/`completed` saja.** — `pending`/`expired`/`cancelled` tetap TAMPIL di tabel (kolom Status) untuk transparansi, tapi TIDAK dihitung sebagai pendapatan. Catatan kaki menjelaskan ini ke pengguna. "Jumlah Pesanan" = semua baris dalam filter; "Pesanan Selesai" = count `completed`.

- **2026-06-22 — Filter tanggal Hari Ini/Semua dihitung CLIENT-SIDE basis WIB, bukan query `gte/lte`.** — Semua order di-fetch sekali lalu disaring via `jakartaDate(created_at) === jakartaDate(now)` (Intl en-CA, `Asia/Jakarta`). Menghindari konversi batas hari UTC↔WIB yang rawan off-by-one; volume warung kecil sehingga fetch-all murah. Stat ikut difilter agar konsisten dengan tabel.

- **2026-06-22 — Reports fetch sekali saat mount (tanpa Realtime), beda dengan dashboard pesanan.** — Laporan bersifat tinjauan, tak butuh push langsung; menghindari beban subscription. Pengguna bisa reload bila perlu data terbaru. (Dashboard pesanan tetap Realtime karena operasional.)

- **2026-06-22 — Nav header admin (Pesanan/Laporan) ditambah di `(protected)/layout.tsx` dengan highlight `usePathname`.** — Dua halaman admin kini perlu navigasi; diletakkan di layout bersama agar konsisten lintas halaman.

## Status WAJIB

- **2026-06-22 — Seluruh fitur WAJIB (CLAUDE.md §11 langkah 1–9) SELESAI & build kedua app lulus.** — Customer: menu→detail→cart→checkout→QRIS(Midtrans charge)→success. Admin: webhook(`paid`)→login→dashboard realtime(tandai selesai)→laporan. Sisa: polish (10) + deploy Vercel (11), lalu [OPTIONAL]. Pembayaran `paid` tetap eksklusif webhook; admin tak bisa men-set `paid`.

## Iterasi 9 — Polish + edge cases

- **2026-06-22 — Guard invariant `Σ(item_details) === gross_amount` ditambah di `/api/checkout` sebelum charge.** — Implementasi §13 secara eksplisit. Walau perhitungan saat ini selalu konsisten (harga & qty integer, `calcOrderAmounts`), guard menangkap regresi mendatang sebelum Midtrans menolak, dan menghapus order menggantung bila tak cocok.

- **2026-06-22 — Expiry ditangani di klien (countdown habis) DAN via status webhook, dengan CTA "Pesan Lagi".** — Karena webhook bisa telat/absen saat dev, `PaymentStatusWatcher` menampilkan blok kedaluwarsa + tombol begitu countdown lokal `<= 0`, tidak menunggu status `expired` dari Midtrans. Status `cancelled`/`expired` dari webhook juga memunculkan blok yang sama. Polling tetap jalan sehingga jika `paid` menyusul, redirect sukses tetap terjadi.

- **2026-06-22 — `loading.tsx` global di customer (bukan per-route).** — Satu spinner di `app/loading.tsx` meng-cover semua segmen yang fetch (menu, item, pay) tanpa duplikasi. Konsisten dengan spinner admin.

### Risiko diketahui / ditunda ke [OPTIONAL]

- **Proteksi admin sisi-klien (bukan middleware).** Ada potensi flash sekejap sebelum redirect; DATA tetap aman via RLS (anon tak baca orders). Bila ingin server-enforced, migrasi ke `@supabase/ssr` + middleware (OPTIONAL).
- **Customer pantau status via polling 4 dtk, bukan Realtime.** Konsekuensi keputusan RLS (anon tak SELECT orders). Cukup untuk skala warung; bisa diganti Realtime + policy SELECT terbatas per-order (OPTIONAL).
- **Foto menu = placeholder CSS.** Skema belum punya kolom foto; ganti foto asli = OPTIONAL (butuh kolom + storage).
- **QR tetap tampil walau countdown habis** (gambar di RSC; watcher hanya menambah pesan di bawah). Tidak menyembunyikan QR agar tak menambah koordinasi server↔client; pesan + CTA sudah jelas.
- **Auto-pause Supabase free tier** bila idle 1 minggu (CLAUDE.md §3) — operasional, bukan kode.
- **`order_code` sequence berbasis count + retry** — aman untuk skala warung; bukan generator industrial. (Keputusan iterasi 3.)

## Iterasi 10 — Deploy (persiapan + runbook)

- **2026-06-22 — Deploy via 2 project Vercel dari 1 repo, Root Directory per-app, TANPA `vercel.json`.** — Sesuai CLAUDE.md §10: tiap app = project Vercel terpisah (`apps/customer` → `nasipadangajodatuak`, `apps/admin` → `adminajodatuak`). Framework Next.js auto-detect + Root Directory sudah cukup; tak perlu `vercel.json` atau override build command. Lockfile tunggal di root → Vercel install dari root workspace otomatis (opsi "include files outside root directory" aktif default untuk monorepo, membawa `packages/shared`).

- **2026-06-22 — Tambah `outputFileTracingRoot` (root monorepo) di kedua `next.config.mjs`.** — Saat Root Directory di-set ke `apps/<app>`, Next bisa salah menebak tracing root (mengira app dir) dan/atau memunculkan warning multi-lockfile, berpotensi melewatkan file workspace `@ajo/shared`. Pin eksplisit ke `path.join(__dirname, "../../")` menjamin tracing benar di build Vercel. Perubahan minimal, build kedua app tetap lulus. Bukan perubahan keputusan CLAUDE.md — murni penyesuaian build monorepo.

- **2026-06-22 — `MIDTRANS_SERVER_KEY` WAJIB identik di project customer & admin.** — Customer membuat signature charge dengan server key; webhook admin memverifikasi signature dengan server key. Beda key → verifikasi 403 → status tak pernah `paid`. Ditegaskan eksplisit di `DEPLOY.md` §3. `SUPABASE_SERVICE_ROLE_KEY` & `MIDTRANS_SERVER_KEY` SERVER-ONLY (tanpa `NEXT_PUBLIC_`) — konsisten dgn CLAUDE.md §7.4/§13.

- **2026-06-22 — Notification URL Midtrans = global per akun Sandbox, dipindah dari ngrok ke domain admin produksi saat deploy.** — Bukan per-transaksi; satu URL untuk semua notifikasi. Saat dev → ngrok; produksi → `https://adminajodatuak.vercel.app/api/midtrans/webhook` (CLAUDE.md §11 langkah 11).

- **2026-06-22 — Runbook ditulis sebagai `DEPLOY.md`; eksekusi deploy = manual oleh pemilik.** — Agent tak punya akses akun Vercel/Supabase/Midtrans, jadi deploy aktual dilakukan pemilik mengikuti runbook. CONTEXT.md menandai langkah 11 sebagai "siap, belum dieksekusi" — bukan "live" — agar status jujur sampai runbook benar-benar dijalankan.

## Iterasi 11 — Foto menu

- **2026-06-22 — Foto disimpan sebagai aset statis di `apps/customer/public/menu/`, direferensikan via kolom `image_url` (path relatif), BUKAN Supabase Storage.** — Foto bagian dari app customer & jarang berubah; menaruhnya di `public/` membuatnya ikut ter-deploy & dilayani CDN Vercel tanpa setup bucket/RLS Storage. Kolom `image_url` cukup menyimpan path (`/menu/<file>`). Supabase Storage = OPTIONAL bila nanti butuh upload foto dari admin.

- **2026-06-22 — Render foto via `next/image` (`fill` + `object-cover`), bukan `<img>` mentah.** — Foto sumber ~3MB/file; `next/image` mengoptimasi (resize/format) saat request sehingga mobile tak mengunduh 3MB. `FoodImage` jadi dua mode: `src` ada → foto; `null` → placeholder cream/tan lama (tetap on-brand). Aman saat build (optimasi terjadi runtime).

- **2026-06-22 — Nama file foto diubah ke kebab-case web-safe; foto tanpa nama jelas diberi nama "(perlu dicek)".** — File asli punya spasi/karakter aneh (`---.jpg`, `Ayam .....jpg`, `Apa Ini.jpg`) → di-rename agar URL bersih. Foto yang namanya belum dipastikan tetap DIMASUKKAN ke menu (sesuai permintaan pemilik) dengan nama bertanda "(perlu dicek)" agar gampang dicari & di-rename via `update menu_items set name=... `. Semua foto = kategori **Lauk** kecuali **Paket Mahasiswa** (instruksi pemilik).

- **2026-06-22 — Item tanpa foto TETAP ada di menu dengan placeholder (tidak disembunyikan).** — Ayam Gulai, Nasi, Nasi Rames, seluruh Minuman belum punya foto → `image_url = null` → `FoodImage` menampilkan placeholder lama. Menu tetap lengkap; foto menyusul. Konsisten permintaan pemilik ("yang belum ada fotonya tetap ada, pakai placeholder seperti sekarang").

- **2026-06-22 — Perubahan DB lewat migration terpisah (`migration_iter11_menu_images.sql`), bukan hanya edit `schema.sql`.** — `schema.sql` seed hanya jalan saat tabel kosong; DB pemilik sudah terisi sejak iterasi 1. Migration menambah kolom + update foto item lama (by name) + insert item baru (guard `not exists` by name) secara idempotent. `schema.sql` tetap diperbarui agar install bersih juga benar. (Pola sama dgn `migration_iter4_midtrans.sql`.) CLAUDE.md TIDAK diubah — ini ekstensi DB pendukung (skema §8.1 tak punya kolom foto), bukan perubahan keputusan.

## Iterasi 12 — Logo brand

- **2026-06-22 — Logo disimpan di `public/` MASING-MASING app (customer & admin), bukan di `packages/shared`.** — Aset statis Next dilayani dari `public/` per-app, dan tiap app = project Vercel terpisah (Root Directory beda), jadi keduanya butuh salinan sendiri. Tak ada mekanisme berbagi `public/` lintas app di Next. Duplikasi 2 file PNG dapat diterima.

- **2026-06-22 — Konvensi: `logo-dark` (warna gelap) → latar TERANG; `logo-light` (warna terang) → latar GELAP.** — Nama varian mengikuti warna logo itu sendiri (sesuai file dari pemilik), dipilih berdasarkan kontras dengan background di belakangnya. Semua header/branding saat ini berlatar terang (`bg-white`, `bg-cream-50`, kartu cream) → seluruhnya pakai `logo-dark.png`. `logo-light.png` disertakan untuk komponen berlatar gelap di masa depan.

- **2026-06-22 — Logo dirender via `next/image` (`object-contain`, `priority`) dengan intrinsic 2000×2000 + ukuran tampil lewat className.** — Ukuran asli besar (2000²); `next/image` mengoptimasi & mencegah CLS. `priority` karena logo above-the-fold di header/login. `object-contain` jaga rasio kotak.

- **2026-06-22 — Di header padat (customer & admin) logo tetap dipasangkan dgn teks/badge; di login (lega) logo ditampilkan besar tanpa teks "Ajo Datuak".** — Logo = lockup vertikal lengkap (ikon rumah gadang + wordmark). Pada header tinggi ~64px wordmark di dalam logo jadi tak terbaca, maka logo berfungsi sbg "mark" + teks nama/badge "Admin" tetap memberi konteks. Di halaman login ada ruang → logo h-28 dgn wordmark terbaca, sehingga judul teks "Ajo Datuak" yang lama dihapus (hindari duplikasi).

- **2026-06-22 — Favicon/tab icon belum diganti (tetap default Next).** — Ditunda: favicon kecil (16–32px) membuat wordmark tak terbaca & pemilihan varian gelap/terang harus mempertimbangkan mode tab browser (gelap/terang) yang tak bisa dipastikan. Bisa ditambah via `app/icon.png` nanti (OPTIONAL).
