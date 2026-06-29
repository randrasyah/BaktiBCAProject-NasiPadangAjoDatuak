"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRupiah } from "@ajo/shared";
import type { Order, OrderItem } from "@ajo/shared";
import { getBrowserClient } from "../../../lib/supabase-browser";

type OrderWithItems = Order & { order_items: OrderItem[] };

// Order aktif (masih ditangani admin): pending -> preparing -> paid.
// 'completed' (+ expired/cancelled lama) masuk ke tab Riwayat.
const ACTIVE_STATUSES = ["pending", "preparing", "paid"] as const;

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

// Label status order (lifecycle manual tanpa pembayaran online, 2026-06-29).
function statusLabel(status: string): { text: string; cls: string } {
  switch (status) {
    case "pending":
      return { text: "Masuk", cls: "bg-accent/15 text-accent" };
    case "preparing":
      return { text: "Disajikan", cls: "bg-brown-400/15 text-brown-600" };
    case "paid":
      return { text: "Sudah Dibayar", cls: "bg-[#6FA86A]/15 text-[#3f6b34]" };
    case "completed":
      return { text: "Selesai", cls: "bg-[#6FA86A]/15 text-[#3f6b34]" };
    case "expired":
      return { text: "Kedaluwarsa", cls: "bg-tan-200 text-brown-600" };
    case "cancelled":
      return { text: "Dibatalkan", cls: "bg-[#D96C6C]/15 text-[#9b2c2c]" };
    default:
      return { text: status, cls: "bg-tan-200 text-brown-600" };
  }
}

// Aksi berikutnya yang bisa dilakukan admin untuk memajukan order.
// pending -> "Proses Pesanan" -> preparing -> "Sudah Dibayar" -> paid ->
// "Selesai" -> completed. (RLS hanya mengizinkan target preparing/paid/completed.)
type NextStatus = "preparing" | "paid" | "completed";
function nextAction(status: string): { label: string; next: NextStatus } | null {
  switch (status) {
    case "pending":
      return { label: "Proses Pesanan", next: "preparing" };
    case "preparing":
      return { label: "Sudah Dibayar", next: "paid" };
    case "paid":
      return { label: "Selesai", next: "completed" };
    default:
      return null;
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"aktif" | "riwayat">("aktif");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) {
      setError("Gagal memuat pesanan.");
    } else {
      setError(null);
      setOrders((data as OrderWithItems[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = getBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Pastikan koneksi Realtime memakai token sesi (agar RLS meloloskan baris).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) supabase.realtime.setAuth(session.access_token);

      await load();

      // Realtime: refetch saat ada perubahan orders / order_items.
      channel = supabase
        .channel("orders-admin")
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "order_items" },
          () => load(),
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  // Memajukan order ke status berikutnya (manual). Set timestamp sesuai target:
  // paid -> paid_at, completed -> completed_at. RLS mengizinkan admin menulis
  // preparing/paid/completed (CLAUDE.md §8.6).
  async function advance(id: string, next: NextStatus) {
    setBusyId(id);
    setError(null);
    const supabase = getBrowserClient();
    const patch: Record<string, unknown> = { status: next };
    if (next === "paid") patch.paid_at = new Date().toISOString();
    if (next === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) {
      setError("Gagal memperbarui pesanan. Coba lagi.");
    }
    await load();
    setBusyId(null);
  }

  const filtered = orders.filter((o) =>
    tab === "aktif"
      ? (ACTIVE_STATUSES as readonly string[]).includes(o.status)
      : !(ACTIVE_STATUSES as readonly string[]).includes(o.status),
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brown-800">Pesanan</h1>
        {/* Filter Aktif / Riwayat */}
        <div className="inline-flex rounded-xl border border-tan-200 bg-cream-100 p-1">
          {(["aktif", "riwayat"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                tab === t ? "bg-brown-600 text-cream-50" : "text-brown-600 hover:text-brown-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-[#D96C6C]/40 bg-[#D96C6C]/10 px-4 py-3 text-sm text-[#9b2c2c]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-tan-200 border-t-brown-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-tan-200 bg-cream-100 p-12 text-center">
          <p className="font-semibold text-brown-800">
            {tab === "aktif" ? "Belum ada pesanan aktif" : "Belum ada riwayat"}
          </p>
          <p className="mt-1 text-sm text-brown-600">
            {tab === "aktif"
              ? "Pesanan baru akan muncul di sini secara otomatis."
              : "Pesanan yang sudah selesai akan tampil di sini."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((order) => {
            const badge = statusLabel(order.status);
            const action = nextAction(order.status);
            return (
              <article
                key={order.id}
                className="flex flex-col rounded-2xl border border-tan-200 bg-white p-5 shadow-[0_4px_20px_rgba(92,61,46,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-brown-800">{order.order_code}</p>
                    <p className="text-sm text-brown-600">Meja {order.table_number}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badge.cls}`}
                  >
                    {badge.text}
                  </span>
                </div>

                {/* Item */}
                <ul className="mt-4 space-y-1.5 border-t border-tan-200 pt-3">
                  {order.order_items
                    ?.slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((it) => (
                      <li key={it.id} className="text-sm">
                        <div className="flex justify-between text-brown-900">
                          <span>
                            <span className="font-semibold">{it.quantity}×</span> {it.name}
                          </span>
                          <span className="text-brown-600">
                            {formatRupiah(it.price * it.quantity)}
                          </span>
                        </div>
                        {it.note && <p className="text-xs italic text-brown-400">“{it.note}”</p>}
                      </li>
                    ))}
                </ul>

                {/* Total */}
                <div className="mt-3 flex items-center justify-end border-t border-tan-200 pt-3">
                  <span className="text-lg font-bold text-brown-800">
                    {formatRupiah(order.total)}
                  </span>
                </div>

                <p className="mt-2 text-xs text-brown-400">{formatTime(order.created_at)}</p>

                {/* Aksi — maju satu tahap: Proses Pesanan → Sudah Dibayar → Selesai */}
                <div className="mt-4">
                  {order.status === "completed" ? (
                    <div className="rounded-xl bg-[#6FA86A]/10 py-2.5 text-center text-sm font-bold text-[#3f6b34]">
                      ✓ Selesai
                    </div>
                  ) : action ? (
                    <button
                      type="button"
                      onClick={() => advance(order.id, action.next)}
                      disabled={busyId === order.id}
                      className="w-full rounded-xl bg-brown-600 py-2.5 text-sm font-bold text-cream-50 transition-colors hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === order.id ? "Menyimpan…" : action.label}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
