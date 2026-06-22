"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Client Supabase anon untuk BROWSER admin. Dipakai untuk:
//  - Supabase Auth (login/logout, sesi disimpan di localStorage),
//  - membaca orders/order_items (RLS: authenticated boleh SELECT),
//  - Realtime subscription (menghormati RLS via token sesi),
//  - UPDATE status -> 'completed' (RLS: with check status='completed').
//
// Hanya anon key (NEXT_PUBLIC_) — tidak ada secret. Service role TIDAK dipakai
// di browser; penulisan 'paid' eksklusif webhook server (CLAUDE.md §4).
// Singleton agar tidak membuat banyak GoTrueClient.
let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env belum di-set. Salin apps/admin/.env.example -> .env.local lalu isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
