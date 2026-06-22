import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { formatRupiah } from "@ajo/shared";
import { createAdminClient } from "../../../lib/supabase-admin";
import { PaymentStatusWatcher } from "../../../components/PaymentStatusWatcher";

export const dynamic = "force-dynamic";

interface OrderForPay {
  id: string;
  order_code: string;
  table_number: string;
  total: number;
  status: string;
  qris_string: string | null;
  qris_url: string | null;
  qris_expiry: string | null;
}

// Halaman pembayaran QRIS (CLAUDE.md §5.3). Order dibaca SERVER-SIDE via service
// role (anon tak punya akses baca `orders`, §8.6). QR di-render dari qris_string
// (payload EMV) menjadi data URL — tidak hotlink ke Midtrans. Status dipantau
// PaymentStatusWatcher (polling route server).
export default async function PayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  let order: OrderForPay | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("orders")
      .select("id, order_code, table_number, total, status, qris_string, qris_url, qris_expiry")
      .eq("id", orderId)
      .maybeSingle();
    order = (data as OrderForPay | null) ?? null;
  } catch {
    order = null;
  }

  if (!order) notFound();

  // Render QR dari qris_string jadi data URL (di server).
  let qrDataUrl: string | null = null;
  if (order.qris_string) {
    try {
      qrDataUrl = await QRCode.toDataURL(order.qris_string, {
        margin: 1,
        width: 320,
        color: { dark: "#3E2A20", light: "#FFFFFF" },
      });
    } catch {
      qrDataUrl = null;
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center px-5 py-10">
      <h1 className="text-xl font-semibold text-brown-800">Pembayaran QRIS</h1>
      <p className="mt-1 text-sm text-brown-600">
        Pesanan {order.order_code} · Meja {order.table_number}
      </p>

      {/* QR */}
      <div className="mt-8 flex aspect-square w-64 max-w-full items-center justify-center overflow-hidden rounded-2xl border border-tan-200 bg-white p-3 shadow-[0_4px_20px_rgba(92,61,46,0.08)]">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR pembayaran QRIS" className="h-full w-full object-contain" />
        ) : order.qris_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={order.qris_url} alt="QR pembayaran QRIS" className="h-full w-full object-contain" />
        ) : (
          <span className="px-6 text-center text-sm font-medium text-brown-400">
            QR tidak tersedia. Coba pesan ulang.
          </span>
        )}
      </div>

      <p className="mt-5 max-w-xs text-center text-sm text-brown-400">
        Scan untuk membayar. Selama pengembangan, bayar lewat{" "}
        <a
          href="https://simulator.sandbox.midtrans.com/v2/qris/index"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brown-600 underline underline-offset-2"
        >
          Midtrans Payment Simulator
        </a>
        .
      </p>

      {/* Helper dev: tampilkan QR Code Image URL agar bisa langsung ditempel ke
          field "QR Code Image URL" di simulator. Hanya muncul di Sandbox. */}
      {process.env.MIDTRANS_IS_PRODUCTION !== "true" && order.qris_url && (
        <details className="mt-3 w-full rounded-xl border border-tan-200 bg-cream-100 px-4 py-3 text-xs text-brown-600">
          <summary className="cursor-pointer font-semibold">
            Dev: QR Code Image URL (untuk Simulator)
          </summary>
          <p className="mt-2 select-all break-all font-mono text-brown-800">{order.qris_url}</p>
          <p className="mt-2 text-brown-400">
            Buka Simulator → QRIS → tempel URL di atas ke field “QR Code Image URL” →
            Inquiry → Pay. Status akan otomatis jadi lunas dalam beberapa detik.
          </p>
        </details>
      )}

      <div className="mt-6 w-full rounded-2xl border border-tan-200 bg-white p-5 shadow-[0_4px_20px_rgba(92,61,46,0.08)]">
        <div className="flex items-center justify-between">
          <span className="text-brown-600">Total Pembayaran</span>
          <span className="text-2xl font-bold text-accent">{formatRupiah(order.total)}</span>
        </div>
      </div>

      <PaymentStatusWatcher
        orderId={order.id}
        initialStatus={order.status}
        expiry={order.qris_expiry}
      />

      <Link
        href="/"
        className="mt-8 text-sm font-semibold text-brown-600 underline-offset-4 hover:underline"
      >
        Kembali ke menu
      </Link>
    </div>
  );
}
