"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, ClockIcon } from "./icons";

const POLL_MS = 4000;

// Tiga tahap yang dilihat pelanggan (CLAUDE.md §5.5):
//   Pesanan Masuk -> Sedang Disajikan -> Pesanan Selesai
// Pemetaan status DB -> indeks tahap aktif:
//   pending            -> 0 (Pesanan Masuk)
//   preparing | paid   -> 1 (Sedang Disajikan)   ← "Sudah Dibayar" (admin) tetap tampil "disajikan"
//   completed          -> 2 (Pesanan Selesai)
const STEPS = [
  { title: "Pesanan Masuk", desc: "Pesananmu sudah diterima." },
  { title: "Sedang Disajikan", desc: "Pesananmu sedang disiapkan." },
  { title: "Pesanan Selesai", desc: "Selamat menikmati! Terima kasih 🤎" },
] as const;

function stageIndex(status: string): number {
  switch (status) {
    case "completed":
      return 2;
    case "preparing":
    case "paid":
      return 1;
    default:
      return 0; // pending
  }
}

// Memantau status order via polling route server (READ-ONLY). Status dimajukan
// MANUAL oleh admin; halaman ini hanya membaca & menampilkan progres.
export function OrderStatusTracker({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    // Status terminal (selesai/batal/kedaluwarsa) → berhenti polling.
    if (status === "completed" || status === "cancelled" || status === "expired") return;
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

  // Order dibatalkan (sisa alur lama) — tampilkan pesan netral.
  if (status === "cancelled" || status === "expired") {
    return (
      <div className="mt-8 w-full rounded-2xl border border-[#D96C6C]/40 bg-[#D96C6C]/10 p-5 text-center">
        <p className="text-sm font-semibold text-[#9b2c2c]">
          Pesanan {status === "cancelled" ? "dibatalkan" : "kedaluwarsa"}.
        </p>
      </div>
    );
  }

  const active = stageIndex(status);
  const done = status === "completed";

  return (
    <div className="mt-8 w-full">
      <ol className="relative">
        {STEPS.map((step, i) => {
          const isDone = i < active || done;
          const isCurrent = i === active && !done;
          const isPending = i > active;
          const isLast = i === STEPS.length - 1;

          return (
            <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
              {/* Garis penghubung antar tahap */}
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 ${
                    i < active || done ? "bg-[#6FA86A]" : "bg-tan-200"
                  }`}
                />
              )}

              {/* Indikator bulat */}
              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                  isDone
                    ? "border-[#6FA86A] bg-[#6FA86A] text-white"
                    : isCurrent
                      ? "border-brown-600 bg-cream-50 text-brown-600"
                      : "border-tan-200 bg-cream-50 text-brown-400"
                }`}
              >
                {isDone ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : isCurrent ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brown-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brown-600" />
                  </span>
                ) : (
                  <span className="text-sm font-bold">{i + 1}</span>
                )}
              </span>

              {/* Teks tahap */}
              <div className="pt-0.5">
                <p
                  className={`font-bold ${
                    isPending ? "text-brown-400" : "text-brown-800"
                  }`}
                >
                  {step.title}
                </p>
                {(isCurrent || (isDone && isLast)) && (
                  <p className="mt-0.5 text-sm text-brown-600">{step.desc}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!done && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-brown-400">
          <ClockIcon className="h-4 w-4" />
          Status diperbarui otomatis…
        </div>
      )}
    </div>
  );
}
