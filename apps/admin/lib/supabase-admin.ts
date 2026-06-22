import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client Supabase SERVICE ROLE — BYPASS RLS. HANYA boleh dipakai di server
// (route handler webhook / RSC admin). `import "server-only"` membuat build
// GAGAL bila file ini sampai ter-bundle ke client. Key dibaca dari
// SUPABASE_SERVICE_ROLE_KEY (TANPA prefix NEXT_PUBLIC_), jadi tidak pernah
// terekspos ke browser. Lihat CLAUDE.md §7.4 & §8.6.
//
// Di apps/admin, ini adalah SATU-SATUNYA jalur yang menulis status 'paid'
// (lewat webhook Midtrans). Lihat CLAUDE.md §4.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Env server belum lengkap: butuh NEXT_PUBLIC_SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY di .env.local.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
