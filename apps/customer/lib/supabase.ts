import { createClient } from "@supabase/supabase-js";

// Client Supabase anon (publik). Dipakai untuk BACA menu_items (RLS: select publik).
// Aman dipakai di server (RSC) maupun browser — hanya anon key, tidak ada secret.
// Insert order & data sensitif TIDAK lewat sini (itu via route server + service role,
// iterasi berikutnya). Lihat CLAUDE.md §8.6.
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env belum di-set. Salin apps/customer/.env.example -> .env.local lalu isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
