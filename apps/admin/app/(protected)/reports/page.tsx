"use client";

import { useEffect, useMemo, useState } from "react";
import { formatRupiah } from "@ajo/shared";
import type { Order, OrderItem } from "@ajo/shared";
import { getBrowserClient } from "../../../lib/supabase-browser";

type OrderWithItems = Order & { order_items: OrderItem[] };
type Mode = "harian" | "bulanan";

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

// --- Util navigasi periode (memakai jangkar siang UTC agar aman dari offset) ---
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function formatDayLabel(day: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
function formatDayShort(day: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
function formatMonthLabel(month: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "Masuk", cls: "bg-accent/15 text-accent" },
  preparing: { text: "Disajikan", cls: "bg-brown-400/15 text-brown-600" },
  paid: { text: "Dibayar", cls: "bg-[#6FA86A]/15 text-[#3f6b34]" },
  completed: { text: "Selesai", cls: "bg-[#6FA86A]/15 text-[#3f6b34]" },
  expired: { text: "Kedaluwarsa", cls: "bg-tan-200 text-brown-600" },
  cancelled: { text: "Dibatalkan", cls: "bg-[#D96C6C]/15 text-[#9b2c2c]" },
};

export default function ReportsPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("harian");
  // Nilai "hari ini" / "bulan ini" basis WIB sebagai default & batas atas (tak ada masa depan).
  const today = jakartaDate(new Date());
  const thisMonth = today.slice(0, 7);
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(thisMonth);

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

  // Pesanan dalam periode terpilih (client-side, basis WIB).
  const rows = useMemo(() => {
    if (mode === "harian") {
      return orders.filter((o) => jakartaDate(o.created_at) === day);
    }
    return orders.filter((o) => jakartaDate(o.created_at).startsWith(month));
  }, [orders, mode, day, month]);

  const stats = useMemo(() => {
    const revenue = rows
      .filter((o) => REVENUE_STATUSES.includes(o.status))
      .reduce((sum, o) => sum + o.total, 0);
    const completed = rows.filter((o) => o.status === "completed").length;
    return { revenue, count: rows.length, completed };
  }, [rows]);

  // Rincian per hari untuk mode bulanan (1 baris per tanggal).
  const dailyBreakdown = useMemo(() => {
    if (mode !== "bulanan") return [];
    const map = new Map<
      string,
      { date: string; count: number; completed: number; revenue: number }
    >();
    for (const o of rows) {
      const d = jakartaDate(o.created_at);
      const e = map.get(d) ?? { date: d, count: 0, completed: 0, revenue: 0 };
      e.count += 1;
      if (o.status === "completed") e.completed += 1;
      if (REVENUE_STATUSES.includes(o.status)) e.revenue += o.total;
      map.set(d, e);
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [rows, mode]);

  function itemSummary(o: OrderWithItems): string {
    return (o.order_items ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((it) => `${it.quantity}× ${it.name}`)
      .join(", ");
  }

  // Navigasi periode.
  const atLatest = mode === "harian" ? day >= today : month >= thisMonth;
  function step(n: number) {
    if (mode === "harian") setDay((d) => addDays(d, n));
    else setMonth((m) => addMonths(m, n));
  }
  const periodLabel = mode === "harian" ? formatDayLabel(day) : formatMonthLabel(month);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-brown-800">Laporan Keuangan</h1>
        {/* Toggle Harian / Bulanan */}
        <div className="inline-flex rounded-xl border border-tan-200 bg-cream-100 p-1">
          {([
            ["harian", "Harian"],
            ["bulanan", "Bulanan"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                mode === key ? "bg-brown-600 text-cream-50" : "text-brown-600 hover:text-brown-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigasi periode (history hari/bulan sebelumnya) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-tan-200 bg-white p-3 shadow-[0_4px_20px_rgba(92,61,46,0.06)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Periode sebelumnya"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-tan-200 text-brown-600 transition-colors hover:bg-cream-100"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={atLatest}
            aria-label="Periode berikutnya"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-tan-200 text-brown-600 transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ›
          </button>
          <span className="ml-1 font-semibold capitalize text-brown-800">{periodLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {mode === "harian" ? (
            <input
              type="date"
              value={day}
              max={today}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="rounded-lg border border-tan-200 bg-cream-50 px-3 py-1.5 text-sm text-brown-800 focus:border-brown-600 focus:outline-none"
            />
          ) : (
            <input
              type="month"
              value={month}
              max={thisMonth}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="rounded-lg border border-tan-200 bg-cream-50 px-3 py-1.5 text-sm text-brown-800 focus:border-brown-600 focus:outline-none"
            />
          )}
          {!atLatest && (
            <button
              type="button"
              onClick={() => (mode === "harian" ? setDay(today) : setMonth(thisMonth))}
              className="rounded-lg border border-tan-200 px-3 py-1.5 text-sm font-semibold text-brown-600 transition-colors hover:bg-cream-100"
            >
              {mode === "harian" ? "Hari Ini" : "Bulan Ini"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-[#D96C6C]/40 bg-[#D96C6C]/10 px-4 py-3 text-sm text-[#9b2c2c]">
          {error}
        </p>
      )}

      {/* Kartu ringkasan periode */}
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
            Tidak ada pesanan pada {mode === "harian" ? "tanggal" : "bulan"} ini.
          </p>
        </div>
      ) : mode === "bulanan" ? (
        /* Rincian per hari dalam bulan terpilih */
        <div className="overflow-x-auto rounded-2xl border border-tan-200 bg-white shadow-[0_4px_20px_rgba(92,61,46,0.06)]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-tan-200 bg-cream-100 text-xs uppercase tracking-wider text-brown-400">
                <th className="px-4 py-3 font-bold">Tanggal</th>
                <th className="px-4 py-3 text-right font-bold">Jumlah Pesanan</th>
                <th className="px-4 py-3 text-right font-bold">Pesanan Selesai</th>
                <th className="px-4 py-3 text-right font-bold">Pendapatan</th>
              </tr>
            </thead>
            <tbody>
              {dailyBreakdown.map((d) => (
                <tr key={d.date} className="border-b border-tan-200 last:border-0 hover:bg-cream-50">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold capitalize text-brown-800">
                    {formatDayShort(d.date)}
                  </td>
                  <td className="px-4 py-3 text-right text-brown-600">{d.count}</td>
                  <td className="px-4 py-3 text-right text-brown-600">{d.completed}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-brown-800">
                    {formatRupiah(d.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Daftar transaksi pada hari terpilih */
        <div className="overflow-x-auto rounded-2xl border border-tan-200 bg-white shadow-[0_4px_20px_rgba(92,61,46,0.06)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-tan-200 bg-cream-100 text-xs uppercase tracking-wider text-brown-400">
                <th className="px-4 py-3 font-bold">No. Pesanan</th>
                <th className="px-4 py-3 font-bold">Waktu</th>
                <th className="px-4 py-3 font-bold">Meja</th>
                <th className="px-4 py-3 font-bold">Item</th>
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
        {mode === "bulanan" && " Klik tanggal pada toggle Harian untuk melihat rincian transaksinya."}
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
