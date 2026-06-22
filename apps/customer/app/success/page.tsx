import { formatRupiah } from "@ajo/shared";
import { createAdminClient } from "../../lib/supabase-admin";
import { CheckCircleIcon } from "../../components/icons";
import { OrderAgainButton } from "../../components/OrderAgainButton";

export const dynamic = "force-dynamic";

interface OrderSummary {
  order_code: string;
  table_number: string;
  total: number;
}

// Halaman sukses (CLAUDE.md §5.4). Order dibaca SERVER-SIDE via service role
// (anon tak boleh baca `orders`, §8.6). id order dibawa dari /pay lewat
// query ?order=<uuid>. Bila tak ada / tak ketemu, tetap tampil pesan sukses
// tanpa kartu ringkasan (graceful).
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;

  let order: OrderSummary | null = null;
  if (orderId) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("orders")
        .select("order_code, table_number, total")
        .eq("id", orderId)
        .maybeSingle();
      order = (data as OrderSummary | null) ?? null;
    } catch {
      order = null;
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 py-12 text-center">
      {/* Centang hijau lembut */}
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#6FA86A]/15">
        <CheckCircleIcon className="h-14 w-14 text-[#4f8a4a]" />
      </div>

      <h1 className="mt-6 text-2xl font-extrabold text-brown-800">Pembayaran Berhasil</h1>
      <p className="mt-2 text-brown-600">Pesanan kamu sedang disiapkan.</p>

      {order && (
        <div className="mt-8 w-full rounded-2xl border border-tan-200 bg-cream-100 p-5 text-left">
          <div className="flex justify-between py-1.5">
            <span className="text-brown-400">Nomor Pesanan</span>
            <span className="font-semibold text-brown-800">{order.order_code}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-brown-400">Nomor Meja</span>
            <span className="font-semibold text-brown-800">{order.table_number}</span>
          </div>
          <div className="mt-1.5 flex justify-between border-t border-tan-200 pt-3">
            <span className="text-brown-600">Total Dibayar</span>
            <span className="text-lg font-bold text-accent">{formatRupiah(order.total)}</span>
          </div>
        </div>
      )}

      <p className="mt-6 text-sm text-brown-400">Terima kasih sudah memesan di Ajo Datuak 🤎</p>

      <OrderAgainButton />
    </div>
  );
}
