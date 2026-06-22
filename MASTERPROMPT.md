# MASTERPROMPT.md — Panduan Membangun Ajo Datuak di Claude Code

Dokumen ini berisi prompt siap-pakai untuk membangun proyek **per iterasi** di Claude Code. Tujuannya: tiap sesi tetap ringan, agent selalu tahu state terkini, dan setiap keputusan tercatat.

**Cara pakai:** kerjakan satu iterasi per sesi Claude Code (atau per blok kerja). Copy isi blok `PROMPT` untuk iterasi yang sedang dikerjakan, paste ke Claude Code. Jangan lompat iterasi — tiap iterasi mengandalkan hasil sebelumnya yang sudah tercatat di `CONTEXT.md`.

---

## 0. Sistem Tiga Dokumen (baca dulu, sekali)

Proyek ini dijaga oleh tiga file di root repo:

| File | Isi | Siapa yang ubah |
|---|---|---|
| **CLAUDE.md** | Masterplan / sumber kebenaran. Logika, skema DB, alur pembayaran, aturan, build order. | **Hampir tidak pernah diubah.** Hanya kamu (pemilik), bila scope berubah. Agent TIDAK mengubahnya tanpa diminta eksplisit. |
| **CONTEXT.md** | **State pembangunan saat ini.** Apa yang sudah jadi, apa yang sedang dikerjakan, apa selanjutnya, cara menjalankan, hal yang masih TODO/diketahui rusak. | Agent meng-update di **akhir setiap iterasi**. |
| **DECISIONS.md** | **Log keputusan teknis** (append-only). Setiap pilihan non-trivial + alasan singkat + tanggal. | Agent **menambah entri** di setiap iterasi yang menghasilkan keputusan. |

`CONTEXT.md` menjawab "di mana kita sekarang?". `DECISIONS.md` menjawab "kenapa dulu kita memutuskan begini?". Keduanya membuat sesi baru bisa melanjutkan tanpa kehilangan konteks.

---

## ⭐ THE RITUAL — wajib disisipkan di SETIAP prompt iterasi

Setiap prompt di bawah sudah memuat ritual ini. Kalau kamu menulis prompt sendiri, selalu mulai & akhiri dengan ini:

> **Di awal:** Read `CLAUDE.md`, `CONTEXT.md`, and `DECISIONS.md` in the repo root before doing anything. `CLAUDE.md` is the source of truth for all logic, schema, and rules — follow it and do not modify it unless I explicitly ask. `CONTEXT.md` tells you the current build state; trust it for what's already done. Do only the scope of THIS iteration — do not jump ahead to future steps.
>
> **Di akhir:** Update `CONTEXT.md` to reflect the new state (what's now done, what's next, how to run it, any known issues/TODOs). Append any non-trivial technical decisions you made to `DECISIONS.md` with a one-line rationale and today's date. Keep both updates concise. Then give me a short summary of what you built and exactly how to test it manually before I start the next iteration.

**Aturan tambahan untuk agent (sisipkan bila perlu):** jangan refactor di luar scope; jangan menambah dependency tanpa menyebut alasannya; jangan menulis file `.env` berisi secret asli (buat `.env.example` saja); kalau ada yang ambigu di `CLAUDE.md`, tanyakan ke saya dulu sebelum menebak.

---

# ITERASI 0 — Inisialisasi Repo & Tiga Dokumen

> **Tujuan:** scaffold monorepo + buat CONTEXT.md & DECISIONS.md. Belum ada UI/logika.

**Sebelum mulai:** pastikan `CLAUDE.md` sudah ada di folder kosong yang akan jadi repo.

### PROMPT

```
Read CLAUDE.md in this folder fully — it's the source of truth for this project. We are starting a fresh build. Do NOT modify CLAUDE.md.

This is ITERATION 0: initialize the monorepo skeleton only. No app features yet.

Tasks:
1. Initialize a git repo and create a MONOREPO structure exactly as described in CLAUDE.md section 10:
   - Root with package.json (npm workspaces), .gitignore (must ignore .env*, node_modules, .next, build output).
   - apps/customer  → a fresh Next.js (App Router) + TypeScript + Tailwind app (mobile-first).
   - apps/admin     → a fresh Next.js (App Router) + TypeScript + Tailwind app (tablet/landscape).
   - packages/shared → empty TS package for shared types/util (types.ts, money.ts, constants.ts as stubs with TODO comments).
2. Set up the cream/brown Tailwind theme tokens from CLAUDE.md section 9 in BOTH apps (extend tailwind config with the exact hex values). Pick one clean font (Plus Jakarta Sans or Inter) and wire it in both apps.
3. Create .env.example files (root and/or per app) listing every env var named in CLAUDE.md section 7.4 — with placeholder values and comments, NO real secrets.
4. Make sure both apps run: `npm run dev` for each should show a minimal placeholder home page styled with the cream background and a brown heading, just to prove the theme works.
5. CREATE two new docs in the repo root:
   - CONTEXT.md → current build state. Include: project overview (1 line), a checklist of all WAJIB build steps from CLAUDE.md section 11 with iteration 0 marked done, "Current state", "Next iteration", and a "How to run" section (commands for each app).
   - DECISIONS.md → a decision log. Add the first entries: monorepo chosen over 2 repos (with rationale: shared schema/types/docs, two Vercel projects via Root Directory), Next.js+TS+Tailwind stack, font choice. Use a simple format: date — decision — rationale.

Do not build any menu, cart, database, or payment logic yet — that's later iterations.

When done: update CONTEXT.md and DECISIONS.md as described, then summarize what you set up and give me the exact commands to run both apps so I can verify the themed placeholder pages.
```

---

# ITERASI 1 — Supabase: Skema, Seed, RLS, Realtime (review dulu)

> **Tujuan:** definisi database. Agent menulis SQL; KAMU menjalankannya di Supabase SQL Editor. Agent tidak punya akses ke Supabase-mu.

**Sebelum mulai:** buat project Supabase gratis di supabase.com, siapkan SQL Editor. Catat Project URL + anon key + service_role key (jangan paste service_role ke chat publik).

### PROMPT

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. CLAUDE.md is the source of truth; do not modify it. Trust CONTEXT.md for current state. This is ITERATION 1 — database definition only. Do only this scope.

Produce the complete Supabase/Postgres setup described in CLAUDE.md section 8, as SQL I can paste into the Supabase SQL Editor myself (you do not have access to my Supabase project). Specifically:

1. A single SQL file (e.g. supabase/schema.sql) containing:
   - The three tables exactly as specified: menu_items, orders, order_items (same columns, types, checks, defaults, the status enum values: pending/paid/completed/expired/cancelled).
   - Seed data for menu_items: all 4 categories and every item listed in CLAUDE.md section 5.1, all priced 15000.
   - RLS policies exactly matching CLAUDE.md section 8.6: menu_items readable by anon; orders/order_items NOT directly writable by anon (writes go through server routes with service role); status 'paid' only via service role (webhook); status 'completed' only by authenticated admin from ANY current status (simplified — owner decision 2026-06-22; no longer requires 'paid' first), enforced so an admin update can only result in 'completed' (admin still cannot set 'paid'); appropriate SELECT policies.
   - Enable Realtime on orders (and order_items if needed).
2. Add clear SQL comments explaining each policy.
3. In packages/shared, fill in types.ts with TypeScript types that mirror the schema (Order, OrderItem, MenuItem, OrderStatus union), constants.ts with the status enum + category names, and money.ts with: a Rupiah formatter, a function to compute PB1 tax (10% of subtotal), and total = subtotal + tax with integer rounding. These must match the schema and CLAUDE.md exactly.
4. Write a short supabase/README.md telling me the manual steps: where to paste the SQL, how to enable Realtime in the dashboard if not done via SQL, and which keys to copy into .env.

Do NOT build UI or call Supabase from app code yet. 

Important: pause after presenting the SQL and shared types and ask me to review before considering the iteration complete. Once I confirm, update CONTEXT.md (mark DB schema done, note that I've run it) and append decisions (RLS approach, any column/type choices, tax rounding rule) to DECISIONS.md.
```

> **Setelah iterasi ini:** paste SQL ke Supabase, jalankan, aktifkan Realtime, isi `.env` lokal di kedua app dengan kredensial Supabase. Konfirmasi ke agent "sudah saya jalankan, lanjut".

---

# ITERASI 2 — Customer: Menu + Detail Item + Cart (UI dari Stitch, data dari Supabase)

> **Tujuan:** halaman menu + halaman detail item + keranjang. Pakai desain Stitch sebagai acuan visual.

**Prasyarat:** Stitch MCP terhubung di Claude Code (lihat catatan di bawah dokumen). Iterasi 1 selesai & SQL sudah dijalankan.

### PROMPT

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. CLAUDE.md is the source of truth; do not modify it. Trust CONTEXT.md. This is ITERATION 2 — the customer Menu, Item Detail, and Cart. Work only in apps/customer. Do only this scope (no checkout cost breakdown logic beyond what's needed, no payment, no admin).

Use the Stitch MCP to fetch the images and generated code for the customer project "Ajo Datuak Digital Menu" screens: "Menu Nasi Padang Ajo Datuak", "Detail Menu - Rendang", and "Keranjang - Nasi Padang Ajo Datuak". Treat Stitch output as the VISUAL reference only — static markup with placeholder data. All behavior, data, and structure come from CLAUDE.md, not Stitch.

Build:
1. Menu page (apps/customer/app/page.tsx) — the home screen. Fetch menu_items from Supabase (anon read) and render the 4 category sections (Paket, Mandatory, Lauk, Minuman) with photo cards, name, and "Rp 15.000". NO descriptions. Read the table number from the URL query param ?table=NN if present and show it. Match the Stitch Menu visual (cream/brown, photo cards). Use placeholder food images for now (note in CONTEXT.md that real photos are pending).
2. Item Detail page (apps/customer/app/item/[id]/page.tsx) — a generic detail page that works for ANY item by id (the "Rendang" Stitch screen is just a template). Show photo, name, price, a quantity selector (min 1), and an optional note field ("Catatan (opsional)"). An "Tambah ke Keranjang" button adds the item+qty+note to the cart and returns to the menu.
3. Cart state — implement a client-side cart (React context) holding items with id, name, price, quantity, note. Persist in memory only (NO localStorage per CLAUDE.md artifact rules — but this is a real Next app, so React context/state is fine; do not over-engineer).
4. Sticky cart bar — appears at the bottom once ≥1 item is in the cart, showing item count + subtotal and a "Lihat Keranjang" button that navigates to /checkout (the checkout page itself is built next iteration — for now just route to a stub /checkout page that lists cart items, no cost breakdown).
5. Use the cream/brown theme and the shared types from packages/shared.

Keep components clean and reusable. When done: update CONTEXT.md (menu/detail/cart done, checkout cost logic + payment still pending, note placeholder images) and append decisions (cart state approach, any component structure choices) to DECISIONS.md. Then tell me exactly how to run apps/customer and what to click to test menu → detail → add to cart → see cart bar.
```

---

# ITERASI 3 — Customer: Checkout + Pajak + Buat Order (server route)

> **Tujuan:** halaman checkout penuh dengan rincian biaya, lalu endpoint server yang membuat order di Supabase (status pending). Belum manggil Midtrans.

### PROMPT

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. CLAUDE.md is the source of truth; do not modify it. Trust CONTEXT.md. This is ITERATION 3 — Checkout page + order creation server route, in apps/customer only. Do only this scope. Do NOT integrate Midtrans yet — the order is created with status 'pending' and we'll add the QRIS charge next iteration.

Build:
1. Checkout page (apps/customer/app/checkout/page.tsx) matching the Stitch "Keranjang" screen visual. It must include:
   - A required numeric "Nomor Meja" input (pre-fill from ?table=NN if available, still editable).
   - The list of cart items with name, qty, note, line price; allow editing qty and removing items here.
   - A cost breakdown card: Subtotal, "Pajak Restoran (10%)", and bold Total — computed with the money.ts helpers from packages/shared (10% PB1, integer rounding). Total must equal what will be sent to Midtrans later.
   - A "Pesan & Bayar" button.
2. A server route apps/customer/app/api/checkout/route.ts that:
   - Receives the cart + table number.
   - Recomputes subtotal/tax/total SERVER-SIDE (never trust client totals) using shared money.ts.
   - Generates a human-readable order_code (e.g. AJD-YYYYMMDD-NNNN).
   - Inserts orders (status 'pending') + order_items into Supabase using the SERVICE ROLE key (server-side only, from env). Snapshot name+price into order_items per CLAUDE.md.
   - Returns the created order id + order_code.
   - For now, on success, redirect the client to /pay/[orderId] (the QRIS page is a stub this iteration — just show the order id, total, and "QR akan muncul di sini" placeholder).
3. Ensure the service role key is read only on the server and is NOT exposed to the client or committed. Update .env.example if any new var is needed.

Security note from CLAUDE.md: status must never be settable from the client; this route only creates 'pending' orders.

When done: update CONTEXT.md (checkout + order creation done, Midtrans charge + webhook still pending, pay page is a stub) and append decisions (order_code format, server-side recompute, anything else) to DECISIONS.md. Then tell me how to test: add items → checkout → submit → confirm a 'pending' order row appears in Supabase and I land on the stub pay page.
```

---

# ITERASI 4 — Midtrans Sandbox: Setup Kredensial + Charge QRIS

> **Tujuan:** generate QRIS asli dari Midtrans Sandbox di halaman /pay. Termasuk langkah memandu kamu membuat akun & ambil server key.

### PROMPT (bagian A — panduan setup untukmu, dijalankan agent sebagai instruksi)

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. CLAUDE.md is the source of truth; do not modify it. This is ITERATION 4 — Midtrans Sandbox QRIS charge, in apps/customer. Do only this scope (charge + display QR + listen for status; the webhook that flips status to 'paid' is the NEXT iteration and lives in apps/admin).

FIRST, before writing code, print for me a short, clear, step-by-step checklist of exactly what I need to do in the Midtrans dashboard to get sandbox credentials, in plain language:
- create a Midtrans account, switch to the Sandbox environment
- where to find the Sandbox Server Key and Client Key
- which env vars to put them in (per CLAUDE.md 7.4: MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION=false), and that they go in apps/customer/.env (server-side, not committed)
- where the Midtrans Payment Simulator is and that we'll use it to "pay" the QR
Then pause and wait for me to confirm I have the keys in .env before continuing to the code, OR proceed to write the code in a way that reads the keys from env so I can fill them in after. State which approach you're taking.
```

### PROMPT (bagian B — implementasi charge)

```
Now implement the QRIS charge (still ITERATION 4, apps/customer):

1. In apps/customer/app/api/checkout/route.ts (or a dedicated lib + the existing route), after creating the 'pending' order, call the Midtrans Core API Sandbox charge endpoint (https://api.sandbox.midtrans.com/v2/charge) with payment_type "qris", transaction_details (order_id = order_code, gross_amount = the server-computed integer total), and item_details. IMPORTANT: item_details total MUST equal gross_amount — include the PB1 tax as its own line item (id "tax", name "Pajak Restoran 10%") so the sum matches, exactly as CLAUDE.md section 7.1 warns.
2. Use the Sandbox Server Key via HTTP Basic auth (base64(serverKey + ":")), server-side only. Never expose the server key to the client.
3. Return the qr_string and/or the QR image URL from Midtrans to the client, and store midtrans_transaction_id on the order row.
4. Build the real /pay/[orderId] page: render the QR (from qr_string → QR image, or hotlink the Midtrans QR image URL), show the total, order_code, table number, a 15:00 countdown, and a "Menunggu pembayaran..." status indicator. Subscribe to this order's row via Supabase Realtime; when status becomes 'paid', redirect to /success (the success page can be a simple stub for now if not built).
5. The page must only READ status — it must never write 'paid'. (Webhook does that, next iteration.)

Test plan to give me: submit an order → a real sandbox QR appears → open the Midtrans Payment Simulator → pay it → (status won't flip to paid until the webhook exists next iteration, so for now just confirm the QR generates and the order has a midtrans_transaction_id). 

When done: update CONTEXT.md (QRIS charge + pay page done; status-flip pending on webhook) and append decisions (item_details tax-line approach, QR rendering method, etc.) to DECISIONS.md.
```

---

# ITERASI 5 — Admin: Webhook Midtrans (flip ke 'paid') + ngrok untuk dev

> **Tujuan:** webhook yang menerima notifikasi Midtrans dan men-set order jadi `paid`. Karena lokal, pakai ngrok.

### PROMPT

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. CLAUDE.md is the source of truth; do not modify it. Trust CONTEXT.md. This is ITERATION 5 — the Midtrans webhook, in apps/admin. Do only this scope. This is the ONLY place allowed to set an order's status to 'paid'.

Build apps/admin/app/api/midtrans/webhook/route.ts exactly per CLAUDE.md section 7.3:
1. Verify the signature: sha512(order_id + status_code + gross_amount + ServerKey) must equal signature_key; reject if it doesn't.
2. Read transaction_status + fraud_status:
   - settlement (or capture + fraud_status accept) → set the matching order (by order_code/order_id) to 'paid', set paid_at and payment_type.
   - pending → leave as pending.
   - expire/cancel/deny → set 'expired' or 'cancelled' accordingly.
3. Be idempotent: if the order is already 'paid'/'completed', ignore duplicate notifications. Always respond HTTP 200 quickly.
4. Read MIDTRANS_SERVER_KEY and the Supabase service role key from apps/admin env (server-side only). Update .env.example for apps/admin.

THEN print clear instructions for me to test locally:
- how to run apps/admin locally and expose the webhook with ngrok (the exact command, e.g. ngrok http <admin-port>)
- exactly where in the Midtrans dashboard to set the Notification URL to the ngrok HTTPS URL + /api/midtrans/webhook
- the end-to-end test: create an order in the customer app → pay via Payment Simulator → confirm the webhook fires, signature verifies, and the order flips to 'paid' in Supabase → confirm the customer /pay page auto-redirects to /success via Realtime.

When done: update CONTEXT.md (payment flow now end-to-end working locally) and append decisions (signature verification, idempotency approach, dev tunneling via ngrok) to DECISIONS.md.
```

---

# ITERASI 6 — Customer: Halaman Sukses (finalisasi alur pelanggan)

> **Tujuan:** halaman konfirmasi centang; pastikan auto-redirect dari /pay saat paid bekerja mulus.

### PROMPT

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. Source of truth = CLAUDE.md (don't modify). Trust CONTEXT.md. This is ITERATION 6 — the customer Success page, apps/customer only. Small scope.

Using the Stitch "Konfirmasi Pembayaran" screen as the visual reference, build apps/customer/app/success/page.tsx:
- Large soft-green checkmark, bold "Pembayaran Berhasil", message "Pesanan kamu sedang disiapkan".
- A small summary card: order_code, table number, total paid (fetch the order by id, read-only).
- A soft outlined brown "Pesan Lagi" button that clears the cart and returns to the menu.
Confirm the /pay/[orderId] → /success auto-redirect (triggered by Realtime status 'paid') works cleanly, including the case where the user refreshes /pay after paying.

When done: update CONTEXT.md (entire customer flow complete: menu → detail → cart → checkout → QRIS → paid → success) and append any decisions to DECISIONS.md. Give me the full customer-flow test steps.
```

---

# ITERASI 7 — Admin: Login + Dashboard Pesanan (realtime)

> **Tujuan:** login sederhana + daftar pesanan realtime + tombol "Tandai Selesai" (bisa untuk order apa pun, tidak harus `paid` dulu — keputusan pemilik 2026-06-22).

### PROMPT

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. Source of truth = CLAUDE.md (don't modify). Trust CONTEXT.md. This is ITERATION 7 — admin Login + Orders Dashboard, apps/admin only. Do only this scope (reports come next iteration).

Use the Stitch admin screens "Login" and "Dashboard Pesanan" as visual references (tablet/landscape). Build:
1. Login (apps/admin/app/login/page.tsx) using Supabase Auth (email+password, single shared account per CLAUDE.md decision — no role tiers). Protect all admin pages: redirect unauthenticated users to /login.
2. Orders dashboard (apps/admin/app/(protected)/orders/page.tsx):
   - Subscribe to orders via Supabase Realtime; newest first; show order_code, table number, items+qty+notes, total, payment status badge (Sudah Dibayar / Belum Dibayar), serving status, timestamp.
   - "Tandai Selesai" button: ENABLED for ANY order regardless of current status (pending OR paid) — owner decision 2026-06-22, no paid-first requirement; orders already 'completed' show a completed state with no active button.
   - Clicking "Tandai Selesai" sets status to 'completed' (with completed_at). ENFORCE in UI and on the server/RLS that an admin update can ONLY result in 'completed' (the RLS from iteration 1 already enforces this via with check (status = 'completed') — verify it). The admin must still NEVER be able to set 'paid'.
   - A simple "Aktif" / "Riwayat" filter.

Security: the client must not be able to set 'paid' (that remains webhook-exclusive). Admin may complete an order from any status.

When done: update CONTEXT.md (admin orders dashboard done; reports pending) and append decisions (auth approach, realtime subscription, how completion rule is enforced) to DECISIONS.md. Tell me how to log in and test marking an order complete (try both a pending and a paid order — both should complete), and confirm the admin cannot set an order to 'paid'.
```

---

# ITERASI 8 — Admin: Laporan Keuangan

> **Tujuan:** tabel transaksi + ringkasan pendapatan.

### PROMPT

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. Source of truth = CLAUDE.md (don't modify). Trust CONTEXT.md. This is ITERATION 8 — admin Financial Report, apps/admin only.

Use the Stitch "Laporan Keuangan" screen as the visual reference. Build apps/admin/app/(protected)/reports/page.tsx:
- 3 summary stat cards: Total Pendapatan (sum of total for paid/completed orders), Jumlah Pesanan, Pesanan Selesai.
- A date filter: "Hari Ini" / "Semua" (minimal).
- A data table with columns: No. Pesanan, Waktu, Meja, Item (comma-separated summary with quantities), Subtotal, Pajak, Total, Status. On-brand warm styling, readable, status badges.
- Reuse shared money.ts formatting.

When done: update CONTEXT.md (reports done — all WAJIB features complete) and append decisions to DECISIONS.md. Give me test steps to verify the totals match the orders in Supabase.
```

---

# ITERASI 9 — Polish, Empty/Error States, Edge Cases

> **Tujuan:** rapikan sebelum deploy. Tangani kasus pinggir dari CLAUDE.md section 13.

### PROMPT

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. Source of truth = CLAUDE.md (don't modify). Trust CONTEXT.md. This is ITERATION 9 — polish + edge cases across both apps. No new features; harden what exists.

Address CLAUDE.md section 13 and general UX polish:
- Empty states (empty cart, no orders yet, no transactions in range) and clear error states (failed checkout, Midtrans charge failure, network errors) — all on-brand.
- QR expiry handling (status 'expire' → show an expired message + a way to re-order).
- Webhook idempotency re-verified; duplicate notifications safe.
- Confirm gross_amount == subtotal+tax == sum(item_details incl. tax line) everywhere; integer rounding consistent.
- Loading indicators where data fetches happen.
- Mobile-first check on customer app; tablet/landscape check on admin.
- Verify no secrets are committed; .env.example complete; .gitignore correct.

When done: update CONTEXT.md (polished; ready for deploy) and append decisions to DECISIONS.md. List anything still risky or deferred to OPTIONAL.
```

---

# ITERASI 10 — Deploy ke Vercel (paling akhir)

> **Tujuan:** dua project Vercel terpisah dari satu monorepo, pindahkan webhook ke domain produksi.

### PROMPT

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. Source of truth = CLAUDE.md (don't modify). Trust CONTEXT.md. This is ITERATION 10 — deployment. We deploy LAST, now that everything works locally.

Give me a precise, step-by-step deployment runbook (you can't access my Vercel/Supabase/Midtrans accounts, so write it as instructions for me), covering:
1. Pushing the monorepo to GitHub.
2. Creating TWO Vercel projects from the same repo:
   - customer project → Root Directory apps/customer → domain nasipadangajodatuak.vercel.app
   - admin project → Root Directory apps/admin → domain adminajodatuak.vercel.app
3. Exactly which environment variables to set in each Vercel project (map them to CLAUDE.md 7.4; remind me service role + Midtrans server key are server-side only).
4. Updating the Midtrans Notification URL from the ngrok URL to the production admin webhook: https://adminajodatuak.vercel.app/api/midtrans/webhook
5. A final end-to-end production smoke test: scan/open the customer URL with ?table=NN → order → pay via Payment Simulator → status flips to paid → success page → order appears in admin dashboard → mark complete → shows in reports.
6. A reminder to keep the Supabase project active (free tier auto-pause) per CLAUDE.md.

Also make any minimal config changes the monorepo needs for Vercel to build each app correctly (e.g. build settings, workspace handling), but nothing more.

When done: update CONTEXT.md (deployed; URLs live) and append deployment decisions to DECISIONS.md.
```

---

# (Opsional) ITERASI 11+ — Fitur OPTIONAL

Hanya setelah semua WAJIB live & stabil. Satu fitur per iterasi, masing-masing dengan ritual yang sama (baca tiga dokumen → kerjakan satu fitur → update CONTEXT.md & DECISIONS.md). Daftar fitur OPTIONAL ada di `CLAUDE.md` section 11:
- Role bertingkat (owner/admin/pegawai)
- Harga per item berbeda + editor menu di admin
- Notifikasi suara order baru
- Print struk
- Toggle stok / sold-out
- Export CSV laporan, filter tanggal lanjutan, grafik
- QR statis per meja (generate URL ?table=NN)

Contoh pembungkus prompt untuk fitur OPTIONAL apa pun:

```
Read CLAUDE.md, CONTEXT.md, and DECISIONS.md first. Source of truth = CLAUDE.md (don't modify). Trust CONTEXT.md. All WAJIB features are complete and deployed. This is an OPTIONAL feature iteration: <NAMA FITUR>. Implement ONLY this feature, keep it consistent with existing patterns and the cream/brown theme, don't regress anything. When done, update CONTEXT.md and DECISIONS.md and give me test steps.
```

---

## Catatan: Menghubungkan Stitch MCP di Claude Code (sekali saja)

Iterasi yang memakai desain (2, 3, 6, 7, 8) mengandalkan Stitch MCP. Hubungkan SEBELUM iterasi 2, di terminal (bukan di dalam sesi Claude Code), pakai URL/transport yang Stitch berikan. Pola umum untuk server HTTP:

```
claude mcp add stitch --transport http <STITCH_MCP_URL> --scope project
```

`--scope project` menulis `.mcp.json` di root repo (cocok untuk monorepo ini). Jika Stitch butuh auth, tambah `--header "Authorization: Bearer <token>"`. Verifikasi dengan `claude mcp list` (di terminal) dan `/mcp` (di dalam sesi). Restart Claude Code setelah menambah server. Manifest screen (project ID + screen ID) otomatis tersedia lewat tool ini — tidak perlu di-paste ke prompt.

> Stitch menghasilkan markup statis + data placeholder. Di setiap iterasi desain, perintahnya selalu: **Stitch = acuan visual; CLAUDE.md = perilaku, data, dan aturan.** Foto makanan placeholder diganti aset asli belakangan.
