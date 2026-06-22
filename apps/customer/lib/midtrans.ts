import "server-only";

// Midtrans Core API — QRIS charge (Sandbox). Lihat CLAUDE.md §7.
// Semua panggilan di server-side; SERVER KEY tidak pernah ke client.

const SANDBOX_CHARGE_URL = "https://api.sandbox.midtrans.com/v2/charge";
const PRODUCTION_CHARGE_URL = "https://api.midtrans.com/v2/charge";

// Baris item yang dikirim ke Midtrans. Jumlah (price*quantity) seluruh baris
// WAJIB sama dengan gross_amount — termasuk baris pajak. (CLAUDE.md §7.1)
export interface ChargeItem {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

export interface QrisChargeResult {
  transactionId: string;
  paymentType: string;
  qrString: string | null; // payload EMV untuk di-render jadi QR
  qrImageUrl: string | null; // URL gambar QR (action generate-qr-code)
  expiryTime: string | null; // ISO; default ~15 menit
  transactionStatus: string; // biasanya "pending" saat charge dibuat
}

export async function chargeQris(params: {
  orderId: string; // = order_code (unik per transaksi)
  grossAmount: number; // = total (subtotal + pajak), integer
  items: ChargeItem[]; // termasuk baris pajak
}): Promise<QrisChargeResult> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY belum di-set di env server.");
  }
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const url = isProduction ? PRODUCTION_CHARGE_URL : SANDBOX_CHARGE_URL;

  // Auth: Basic base64(SERVER_KEY + ":"). (CLAUDE.md §7.2)
  const auth = Buffer.from(`${serverKey}:`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      payment_type: "qris",
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.grossAmount,
      },
      item_details: params.items,
      qris: { acquirer: "gopay" },
    }),
  });

  const data: Record<string, unknown> = await res.json().catch(() => ({}));
  const statusCode = String(data.status_code ?? "");
  // 201 = charge berhasil dibuat (menunggu pembayaran). 200 juga sukses.
  if (!res.ok || (statusCode !== "201" && statusCode !== "200")) {
    const msg = String(data.status_message ?? `HTTP ${res.status}`);
    throw new Error(`Midtrans charge gagal: ${msg}`);
  }

  const actions = Array.isArray(data.actions)
    ? (data.actions as Array<{ name?: string; url?: string }>)
    : [];
  const qrAction = actions.find((a) => a.name === "generate-qr-code");

  return {
    transactionId: String(data.transaction_id ?? ""),
    paymentType: String(data.payment_type ?? "qris"),
    qrString: typeof data.qr_string === "string" ? data.qr_string : null,
    qrImageUrl: qrAction?.url ?? null,
    expiryTime: typeof data.expiry_time === "string" ? data.expiry_time : null,
    transactionStatus: String(data.transaction_status ?? "pending"),
  };
}
