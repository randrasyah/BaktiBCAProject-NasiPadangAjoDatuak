import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================================
// Webhook Midtrans (HTTP Notification) — CLAUDE.md §7.3.
// SATU-SATUNYA tempat yang boleh men-set order ke 'paid' (CLAUDE.md §4).
//
// Alur:
//   1. Verifikasi signature: sha512(order_id + status_code + gross_amount +
//      ServerKey) HARUS sama dengan signature_key. Tolak bila tidak cocok.
//   2. Petakan transaction_status (+ fraud_status) -> status order.
//   3. Idempotent: order yang sudah 'paid'/'completed' tidak diubah lagi.
//   4. Selalu balas 200 cepat untuk notifikasi bertanda-tangan valid
//      (agar Midtrans tidak retry berlebihan).
// =====================================================================

// Verifikasi signature dengan perbandingan timing-safe.
function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    // Salah konfigurasi — balas 500 agar terlihat & Midtrans mencoba lagi.
    return NextResponse.json(
      { error: "MIDTRANS_SERVER_KEY belum di-set." },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid." }, { status: 400 });
  }

  // Ambil field. gross_amount HARUS string mentah dari Midtrans (mis. "49500.00")
  // — jangan diubah, karena ikut dihash untuk signature.
  const orderId = String(body.order_id ?? "");
  const statusCode = String(body.status_code ?? "");
  const grossAmount = String(body.gross_amount ?? "");
  const signatureKey = String(body.signature_key ?? "");
  const transactionStatus = String(body.transaction_status ?? "");
  const fraudStatus = String(body.fraud_status ?? "");
  const transactionId = body.transaction_id ? String(body.transaction_id) : null;
  const paymentType = body.payment_type ? String(body.payment_type) : null;

  // --- 1. Verifikasi signature ---
  if (!verifySignature(orderId, statusCode, grossAmount, serverKey, signatureKey)) {
    return NextResponse.json({ error: "Signature tidak valid." }, { status: 403 });
  }

  const supabase = createAdminClient();

  // Cari order berdasarkan order_code (= order_id Midtrans).
  const { data: order, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("order_code", orderId)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: "Gagal membaca order." }, { status: 500 });
  }
  if (!order) {
    // Tidak ada order cocok — balas 200 agar Midtrans berhenti retry.
    return NextResponse.json({ received: true, note: "order tidak ditemukan" }, { status: 200 });
  }

  const current = (order as { id: string; status: string }).status;
  const orderRowId = (order as { id: string }).id;

  // Status final tidak boleh diubah lagi (idempotent + jangan turunkan 'paid').
  const FINAL = ["paid", "completed"];

  // --- 2. Petakan transaction_status -> status target ---
  let next: "paid" | "expired" | "cancelled" | null = null;
  if (
    transactionStatus === "settlement" ||
    (transactionStatus === "capture" && fraudStatus === "accept")
  ) {
    next = "paid";
  } else if (transactionStatus === "expire") {
    next = "expired";
  } else if (transactionStatus === "cancel" || transactionStatus === "deny") {
    next = "cancelled";
  }
  // 'pending' (atau lainnya) -> biarkan apa adanya.

  // --- 3. Idempotensi ---
  if (!next || FINAL.includes(current)) {
    return NextResponse.json({ received: true, status: current }, { status: 200 });
  }

  // Susun patch.
  const patch: Record<string, unknown> = { status: next };
  if (next === "paid") {
    patch.paid_at = new Date().toISOString();
    if (paymentType) patch.payment_type = paymentType;
    if (transactionId) patch.midtrans_transaction_id = transactionId;
  }

  // Update dengan guard tambahan: hanya bila status saat ini BUKAN final
  // (lindungi dari race / notifikasi duplikat yang tiba bersamaan).
  const { error: updErr } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderRowId)
    .not("status", "in", "(paid,completed)");

  if (updErr) {
    return NextResponse.json({ error: "Gagal update order." }, { status: 500 });
  }

  // --- 4. Selalu 200 cepat ---
  return NextResponse.json({ received: true, status: next }, { status: 200 });
}

// Bantu verifikasi reachability lewat browser (mis. saat cek URL ngrok).
// Midtrans hanya mengirim POST; GET ini hanya untuk Anda.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "midtrans-webhook" });
}
