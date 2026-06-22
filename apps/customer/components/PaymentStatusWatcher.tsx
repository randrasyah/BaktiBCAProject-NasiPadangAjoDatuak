"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClockIcon, CheckCircleIcon } from "./icons";

const POLL_MS = 4000;

// Parse expiry_time Midtrans (string WIB "YYYY-MM-DD HH:mm:ss") jadi epoch ms.
function parseExpiry(raw: string | null): number | null {
  if (!raw) return null;
  const t = Date.parse(raw.replace(" ", "T") + "+07:00");
  return Number.isFinite(t) ? t : null;
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Memantau status order via polling route server (CLAUDE.md §5.3).
// Saat status -> 'paid'/'completed', redirect ke /success (halaman sukses
// dibangun di iterasi berikutnya). Hanya MEMBACA status; tidak pernah menulis.
export function PaymentStatusWatcher({
  orderId,
  initialStatus,
  expiry,
}: {
  orderId: string;
  initialStatus: string;
  expiry: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const expiryMs = useRef(parseExpiry(expiry));
  const [remaining, setRemaining] = useState<number | null>(
    expiryMs.current ? expiryMs.current - Date.now() : null,
  );

  // Polling status.
  useEffect(() => {
    if (status === "paid" || status === "completed") return;
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { status?: string };
          if (!stopped && data.status) setStatus(data.status);
        }
      } catch {
        // diamkan; coba lagi pada interval berikutnya
      }
    }

    const id = setInterval(poll, POLL_MS);
    poll();
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [orderId, status]);

  // Saat lunas, alihkan ke halaman sukses.
  useEffect(() => {
    if (status === "paid" || status === "completed") {
      const t = setTimeout(
        () => router.replace(`/success?order=${orderId}`),
        900,
      );
      return () => clearTimeout(t);
    }
  }, [status, router, orderId]);

  // Countdown kadaluarsa.
  useEffect(() => {
    if (!expiryMs.current) return;
    const id = setInterval(() => {
      setRemaining(expiryMs.current! - Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (status === "paid" || status === "completed") {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-[#7Fae6f]/40 bg-[#7Fae6f]/10 px-4 py-3 text-sm font-semibold text-[#3f6b34]">
        <CheckCircleIcon className="h-5 w-5" />
        Pembayaran diterima — mengalihkan…
      </div>
    );
  }

  const localExpired = remaining !== null && remaining <= 0;

  // Kedaluwarsa (dari webhook) / dibatalkan, ATAU countdown lokal sudah habis
  // (QR Midtrans kemungkinan mati) -> tampilkan pesan + jalan untuk pesan ulang.
  if (status === "expired" || status === "cancelled" || localExpired) {
    const message =
      status === "cancelled"
        ? "Pembayaran dibatalkan."
        : "Waktu pembayaran habis & QR kedaluwarsa.";
    return (
      <div className="mt-6 w-full rounded-2xl border border-[#D96C6C]/40 bg-[#D96C6C]/10 p-5 text-center">
        <p className="text-sm font-semibold text-[#9b2c2c]">{message}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-brown-600 px-5 py-2.5 text-sm font-bold text-cream-50 transition-colors hover:bg-brown-800"
        >
          Pesan Lagi
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2 text-sm text-brown-600">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brown-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brown-600" />
        </span>
        Menunggu pembayaran…
      </div>
      {remaining !== null && (
        <div className="flex items-center gap-1.5 text-brown-400">
          <ClockIcon className="h-4 w-4" />
          Berlaku {formatRemaining(remaining)}
        </div>
      )}
    </div>
  );
}
