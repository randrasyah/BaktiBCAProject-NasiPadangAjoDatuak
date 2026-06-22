import { NextResponse } from "next/server";
import { calcOrderAmounts, ORDER_CODE_PREFIX } from "@ajo/shared";
import { createAdminClient } from "../../../lib/supabase-admin";
import { chargeQris, type ChargeItem } from "../../../lib/midtrans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Item yang diterima dari client. Harga & nama TIDAK dipercaya dari client —
// keduanya di-snapshot dari DB (authoritative). Lihat security note CLAUDE.md §13.
interface IncomingItem {
  id: string;
  quantity: number;
  note?: string | null;
}

// Tanggal lokal Asia/Jakarta (WIB) -> "YYYYMMDD" untuk order_code.
function jakartaYmd(): string {
  // en-CA menghasilkan format YYYY-MM-DD.
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return s.replaceAll("-", "");
}

function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

export async function POST(req: Request) {
  let body: { table_number?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON yang valid." }, { status: 400 });
  }

  // --- Validasi nomor meja (wajib, numerik) ---
  const tableNumber = String(body.table_number ?? "").trim();
  if (!tableNumber || !/^\d+$/.test(tableNumber)) {
    return NextResponse.json(
      { error: "Nomor meja wajib diisi (angka)." },
      { status: 400 },
    );
  }

  // --- Validasi item ---
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Keranjang kosong." }, { status: 400 });
  }
  const items: IncomingItem[] = [];
  for (const raw of body.items as unknown[]) {
    const it = raw as Record<string, unknown>;
    const id = String(it.id ?? "");
    const quantity = Math.floor(Number(it.quantity));
    if (!id || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Item tidak valid." }, { status: 400 });
    }
    items.push({ id, quantity, note: typeof it.note === "string" ? it.note : null });
  }

  const supabase = createAdminClient();

  // --- Ambil harga & nama authoritative dari DB (jangan percaya client) ---
  const ids = [...new Set(items.map((i) => i.id))];
  const { data: menuRows, error: menuErr } = await supabase
    .from("menu_items")
    .select("id, name, price, is_available")
    .in("id", ids);
  if (menuErr) {
    return NextResponse.json({ error: "Gagal memuat menu." }, { status: 500 });
  }
  const menuMap = new Map(
    (menuRows ?? []).map((m) => [m.id as string, m as { id: string; name: string; price: number; is_available: boolean }]),
  );
  // Pastikan semua item ada & tersedia.
  for (const it of items) {
    const m = menuMap.get(it.id);
    if (!m || !m.is_available) {
      return NextResponse.json(
        { error: "Ada item yang tidak tersedia. Muat ulang menu." },
        { status: 409 },
      );
    }
  }

  // --- Hitung biaya SERVER-SIDE (sumber kebenaran) ---
  const subtotalRaw = items.reduce(
    (sum, it) => sum + menuMap.get(it.id)!.price * it.quantity,
    0,
  );
  const { subtotal, tax, total } = calcOrderAmounts(subtotalRaw);

  // --- Buat order_code unik AJD-YYYYMMDD-NNNN, dengan retry bila bentrok ---
  const prefix = `${ORDER_CODE_PREFIX}-${jakartaYmd()}-`;
  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .like("order_code", `${prefix}%`);

  let seq = (count ?? 0) + 1;
  let orderId: string | null = null;
  let orderCode = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    orderCode = prefix + pad4(seq);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        order_code: orderCode,
        table_number: tableNumber,
        status: "pending", // status awal — TIDAK pernah di-set dari client
        subtotal,
        tax,
        total,
      })
      .select("id, order_code")
      .single();

    if (!error && data) {
      orderId = data.id as string;
      orderCode = data.order_code as string;
      break;
    }
    // 23505 = unique_violation (order_code bentrok) -> coba nomor berikutnya
    if (error && (error as { code?: string }).code === "23505") {
      seq += 1;
      continue;
    }
    return NextResponse.json({ error: "Gagal membuat order." }, { status: 500 });
  }

  if (!orderId) {
    return NextResponse.json(
      { error: "Gagal membuat order_code unik, coba lagi." },
      { status: 500 },
    );
  }

  // --- Insert order_items (snapshot nama + harga dari DB) ---
  const itemRows = items.map((it) => {
    const m = menuMap.get(it.id)!;
    return {
      order_id: orderId,
      menu_item_id: it.id,
      name: m.name, // snapshot
      price: m.price, // snapshot harga satuan
      quantity: it.quantity,
      note: it.note && it.note.trim() ? it.note.trim() : null,
    };
  });
  const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
  if (itemsErr) {
    // Best-effort cleanup: hapus order yatim agar tak ada order tanpa item.
    await supabase.from("orders").delete().eq("id", orderId);
    return NextResponse.json({ error: "Gagal menyimpan item order." }, { status: 500 });
  }

  // --- Charge QRIS ke Midtrans (server-side) ---
  // item_details = baris menu + 1 baris pajak, agar jumlahnya == gross_amount (total).
  // (CLAUDE.md §7.1: total item_details WAJIB sama dengan gross_amount.)
  const chargeItems: ChargeItem[] = items.map((it) => {
    const m = menuMap.get(it.id)!;
    return { id: it.id, price: m.price, quantity: it.quantity, name: m.name };
  });
  chargeItems.push({
    id: "tax",
    price: tax,
    quantity: 1,
    name: "Pajak Restoran 10%",
  });

  // Invariant §13: Σ(item_details) — termasuk baris pajak — WAJIB == gross_amount.
  // Kalau tidak, Midtrans menolak charge. Guard agar bug perhitungan tertangkap
  // sebelum memanggil Midtrans (dan tak meninggalkan order menggantung).
  const itemsSum = chargeItems.reduce((s, it) => s + it.price * it.quantity, 0);
  if (itemsSum !== total) {
    await supabase.from("orders").delete().eq("id", orderId);
    return NextResponse.json(
      { error: "Validasi jumlah pembayaran gagal." },
      { status: 500 },
    );
  }

  let charge;
  try {
    charge = await chargeQris({
      orderId: orderCode, // order_id Midtrans = order_code (unik)
      grossAmount: total,
      items: chargeItems,
    });
  } catch (e) {
    // Charge gagal → buang order + item agar tak ada order menggantung tanpa QR.
    await supabase.from("orders").delete().eq("id", orderId);
    const msg = e instanceof Error ? e.message : "Gagal membuat pembayaran QRIS.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // --- Simpan data QRIS ke order (dibaca /pay/[orderId]) ---
  const { error: updErr } = await supabase
    .from("orders")
    .update({
      midtrans_transaction_id: charge.transactionId || null,
      payment_type: charge.paymentType || "qris",
      qris_string: charge.qrString,
      qris_url: charge.qrImageUrl,
      qris_expiry: charge.expiryTime,
    })
    .eq("id", orderId);
  if (updErr) {
    return NextResponse.json({ error: "Gagal menyimpan data pembayaran." }, { status: 500 });
  }

  return NextResponse.json({ id: orderId, order_code: orderCode, total }, { status: 201 });
}
