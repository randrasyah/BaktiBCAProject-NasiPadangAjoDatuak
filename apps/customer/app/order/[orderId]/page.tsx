import { notFound } from "next/navigation";
import { formatRupiah } from "@ajo/shared";
import { createAdminClient } from "../../../lib/supabase-admin";
import { OrderStatusTracker } from "../../../components/OrderStatusTracker";
import { OrderAgainButton } from "../../../components/OrderAgainButton";

export const dynamic = "force-dynamic";

interface OrderForTrack {
  id: string;
  order_code: string;
  table_number: string;
  total: number;
  status: string;
  order_items: { id: string; name: string; price: number; quantity: number; note: string | null }[];
}

// Halaman lacak pesanan (CLAUDE.md §5.5) — pengganti alur pembayaran QRIS.
// Order dibaca SERVER-SIDE via service role (anon tak punya akses baca `orders`,
// §8.6). Tahap dipantau OrderStatusTracker (polling route server, read-only).
export default async function OrderTrackPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  let order: OrderForTrack | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_code, table_number, total, status, order_items(id, name, price, quantity, note)",
      )
      .eq("id", orderId)
      .maybeSingle();
    order = (data as OrderForTrack | null) ?? null;
  } catch {
    order = null;
  }

  if (!order) notFound();

  const items = (order.order_items ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 py-10">
      <h1 className="text-xl font-semibold text-brown-800">Status Pesanan</h1>
      <p className="mt-1 text-sm text-brown-600">
        Pesanan {order.order_code} · Meja {order.table_number}
      </p>

      {/* Stepper tahap */}
      <OrderStatusTracker orderId={order.id} initialStatus={order.status} />

      {/* Ringkasan item */}
      <section className="mt-8 rounded-2xl border border-tan-200 bg-white p-5 shadow-[0_4px_20px_rgba(92,61,46,0.08)]">
        <h2 className="mb-3 font-semibold text-brown-800">Rincian Pesanan</h2>
        <ul className="space-y-2 border-b border-tan-200 pb-3">
          {items.map((it) => (
            <li key={it.id} className="text-sm">
              <div className="flex justify-between text-brown-900">
                <span>
                  <span className="font-semibold">{it.quantity}×</span> {it.name}
                </span>
                <span className="text-brown-600">{formatRupiah(it.price * it.quantity)}</span>
              </div>
              {it.note && <p className="text-xs italic text-brown-400">“{it.note}”</p>}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-brown-600">Total</span>
          <span className="text-lg font-bold text-accent">{formatRupiah(order.total)}</span>
        </div>
        <p className="mt-2 text-xs text-brown-400">Pembayaran dilakukan langsung di tempat.</p>
      </section>

      <OrderAgainButton />
    </div>
  );
}
