"use client";

import { useEffect, useMemo, useState } from "react";
import { formatRupiah } from "@ajo/shared";
import type { Order, OrderItem } from "@ajo/shared";
import { getBrowserClient } from "../../../lib/supabase-browser";

type OrderWithItems = Order & { order_items: OrderItem[] };

const REVENUE_STATUSES = ["paid", "completed"];

// Tanggal lokal Asia/Jakarta (WIB) -> "YYYY-MM-DD".
function jakartaDate(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "Belum Bayar", cls: "bg-accent/15 text-accent" },
  paid: { text: "Dibayar", cls: "bg-[#6FA86A]/15 text-[#3f6b34]" },
  completed: { text: "Selesai", cls: "bg-[#6FA86A]/15 text-[#3f6b34]" },
  expired: { text: "Kedaluwarsa", cls: "bg-tan-200 text-brown-600" },
  cancelled: { text: "Dibatalkan", cls: "bg-[#D96C6C]/15 text-[#9b2c2c]" },
};

export default function ReportsPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"today" | "all">("today");

  useEffect(() => {
    (async () => {
      const supabase = getBrowserClient();
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (error) {
        setError("Gagal memuat laporan.");
      } else {
        setOrders((data as OrderWithItems[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  // Filter rentang tanggal (client-side, basis WIB).
  const rows = useMemo(() => {
    if (range === "all") return orders;
    const today = jakartaDate(new Date());
    return orders.filter((o) => jakartaDate(o.created_at) === today);
  }, [orders, range]);

  const stats = useMemo(() => {
    const revenue = rows
      .filter((o) => REVENUE_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + o.total, 0);
    const completed = rows.filter((o) => o.status === "completed").length;
    return { revenue, count: rows.length, completed };
  }, [rows]);

  function itemSummary(o: OrderWithItems): string {
    return (o.order_items ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((it) => `${it.quantity}× ${it.name}`)
      .join(", ");
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-brown-800">Laporan Keuangan</h1>
        <div className="inline-flex rounded-xl border border-tan-200 bg-cream-100 p-1">
          {([
            ["today", "Hari Ini"],
            ["all", "Semua"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                range === key ? "bg-brown-600 text-cream-50" : "text-brown-600 hover:text-brown-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-[#D96C6C]/40 bg-[#D96C6C]/10 px-4 py-3 text-sm text-[#9b2c2c]">
          {error}
        </p>
      )}

      {/* Kartu ringkasan */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Pendapatan" value={formatRupiah(stats.revenue)} accent />
        <StatCard label="Jumlah Pesanan" value={String(stats.count)} />
        <StatCard label="Pesanan Selesai" value={String(stats.completed)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-tan-200 border-t-brown-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-tan-200 bg-cream-100 p-12 text-center">
          <p className="font-semibold text-brown-800">Belum ada transaksi</p>
          <p className="mt-1 text-sm text-brown-600">
            {range === "today"
              ? "Belum ada pesanan hari ini."
              : "Pesanan akan muncul di sini setelah dibuat."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-tan-200 bg-white shadow-[0_4px_20px_rgba(92,61,46,0.06)]">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-tan-200 bg-cream-100 text-xs uppercase tracking-wider text-brown-400">
                <th className="px-4 py-3 font-bold">No. Pesanan</th>
                <th className="px-4 py-3 font-bold">Waktu</th>
                <th className="px-4 py-3 font-bold">Meja</th>
                <th className="px-4 py-3 font-bold">Item</th>
                <th className="px-4 py-3 text-right font-bold">Subtotal</th>
                <th className="px-4 py-3 text-right font-bold">Pajak</th>
                <th className="px-4 py-3 text-right font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const badge = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending;
                return (
                  <tr
                    key={o.id}
                    className="border-b border-tan-200 last:border-0 hover:bg-cream-50"
                  >
                    <td className="px-4 py-3 font-semibold text-brown-800">{o.order_code}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-brown-600">
                      {formatTime(o.created_at)}
                    </td>
                    <td className="px-4 py-3 text-brown-600">{o.table_number}</td>
                    <td className="max-w-xs px-4 py-3 text-brown-900">{itemSummary(o)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-brown-600">
                      {formatRupiah(o.subtotal)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-brown-600">
                      {formatRupiah(o.tax)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-brown-800">
                      {formatRupiah(o.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>
                        {badge.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-brown-400">
        Total Pendapatan dihitung dari pesanan berstatus <b>Dibayar</b> &amp; <b>Selesai</b>.
      </p>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-tan-200 bg-white p-5 shadow-[0_4px_20px_rgba(92,61,46,0.06)]">
      <p className="text-sm font-medium text-brown-400">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${accent ? "text-accent" : "text-brown-800"}`}>
        {value}
      </p>
    </div>
  );
}
