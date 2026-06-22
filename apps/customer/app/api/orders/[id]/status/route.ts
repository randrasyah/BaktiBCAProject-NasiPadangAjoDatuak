import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Polling status order untuk halaman pembayaran (CLAUDE.md §5.3, §8.6).
// HANYA BACA. Route ini tidak pernah menulis status — `paid` eksklusif webhook
// (di apps/admin). anon tak punya policy SELECT `orders`, jadi customer memantau
// lewat route server (service role) ini.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Gagal membaca status." }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
    }
    return NextResponse.json({ status: (data as { status: string }).status });
  } catch {
    return NextResponse.json({ error: "Kesalahan server." }, { status: 500 });
  }
}
