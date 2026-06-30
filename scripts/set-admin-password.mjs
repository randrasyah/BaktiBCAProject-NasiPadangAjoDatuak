// scripts/set-admin-password.mjs
// Ganti password akun admin (Supabase Auth) via Admin API.
//
// Membaca NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY dari
// apps/admin/.env.local (service role = boleh memakai admin API).
//
// CARA PAKAI (jalankan dari root repo):
//   1) Password lewat env var (DIANJURKAN — tidak tersimpan di history shell):
//        Bash:        NEW_ADMIN_PASSWORD='PasswordBaru123' node scripts/set-admin-password.mjs
//        PowerShell:  $env:NEW_ADMIN_PASSWORD='PasswordBaru123'; node scripts/set-admin-password.mjs
//   2) Atau lewat argumen:
//        node scripts/set-admin-password.mjs admin@ajodatuak.id "PasswordBaru123"
//
// Email admin default: admin@ajodatuak.id (override via argumen pertama).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_EMAIL = "admin@ajodatuak.id";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const email = process.argv[2] || DEFAULT_EMAIL;
const newPassword = process.env.NEW_ADMIN_PASSWORD || process.argv[3];

if (!newPassword) {
  console.error(
    "Password baru belum diberikan.\n" +
      "  Contoh: NEW_ADMIN_PASSWORD='PasswordBaru123' node scripts/set-admin-password.mjs",
  );
  process.exit(1);
}
if (newPassword.length < 6) {
  console.error("Password minimal 6 karakter (aturan Supabase Auth).");
  process.exit(1);
}

const env = loadEnv("apps/admin/.env.local");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Env tidak lengkap di apps/admin/.env.local (butuh URL & SERVICE_ROLE_KEY).");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// Cari user berdasarkan email.
const { data: list, error: listErr } = await sb.auth.admin.listUsers();
if (listErr) {
  console.error("Gagal mengambil daftar user:", listErr.message);
  process.exit(1);
}
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`User dengan email "${email}" tidak ditemukan.`);
  process.exit(1);
}

const { error: updErr } = await sb.auth.admin.updateUserById(user.id, {
  password: newPassword,
});
if (updErr) {
  console.error("Gagal mengubah password:", updErr.message);
  process.exit(1);
}

console.log(`✅ Password untuk ${email} berhasil diubah.`);
