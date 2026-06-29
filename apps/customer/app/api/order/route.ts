import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { calcOrderAmounts, ORDER_CODE_PREFIX } from "@ajo/shared";
import { createAdminClient } from "../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================================
// /api/order — buat order TANPA pembayaran online (keputusan 2026-06-29).
// Hanya insert `orders` (status 'pending') + `order_items` via service role,
// lalu kembalikan id agar customer diarahkan ke halaman lacak status
// (/order/[orderId]). Pemrosesan & "Sudah Dibayar" dilakukan MANUAL oleh admin.
//
// Catatan: route pembayaran Midtrans tetap ada di /api/checkout (dipertahankan
// untuk future use). Route ini sengaja TIDAK memanggil Midtrans.
// =====================================================================

// Item yang diterima dari client. Harga & nama TIDAK dipercaya dari client —
// keduanya di-snapshot dari DB (authoritative). Lihat security note CLAUDE.md §13.
interface IncomingItem {
  id: string;
  quantity: number;
  note?: string | null;
}

// Tanggal lokal Asia/Jakarta (WIB) -> "YYYYMMDD" untuk order_code.
function jakartaYmd(): string {
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

// Token acak singkat agar order_code UNIK GLOBAL (mencegah tabrakan nomor urut
// setelah penghapusan order). Charset tanpa 0/O/1/I yang mirip.
function randToken(len = 4): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
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
    return NextResponse.json({ error: "Nomor meja wajib diisi (angka)." }, { status: 400 });
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
    (menuRows ?? []).map((m) => [
      m.id as string,
      m as { id: string; name: string; price: number; is_available: boolean },
    ]),
  );
  for (const it of items) {
    const m = menuMap.get(it.id);
    if (!m || !m.is_available) {
      return NextResponse.json(
        { error: "Ada item yang tidak tersedia. Muat ulang menu." },
        { status: 409 },
      );
    }
  }

  // --- Hitung biaya SERVER-SIDE (sumber kebenaran). tax = 0 (harga sudah
  //     termasuk pajak), total = subtotal. ---
  const subtotalRaw = items.reduce(
    (sum, it) => sum + menuMap.get(it.id)!.price * it.quantity,
    0,
  );
  const { subtotal, tax, total } = calcOrderAmounts(subtotalRaw);

  // --- Buat order_code unik AJD-YYYYMMDD-NNNN-XXXX, dengan retry bila bentrok ---
  const prefix = `${ORDER_CODE_PREFIX}-${jakartaYmd()}-`;
  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .like("order_code", `${prefix}%`);

  let seq = (count ?? 0) + 1;
  let orderId: string | null = null;
  let orderCode = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    orderCode = `${prefix}${pad4(seq)}-${randToken()}`;
    const { data, error } = await supabase
      .from("orders")
      .insert({
        order_code: orderCode,
        table_number: tableNumber,
        status: "pending", // status awal — admin yang memajukan secara manual
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

  return NextResponse.json({ id: orderId, order_code: orderCode, total }, { status: 201 });
}
