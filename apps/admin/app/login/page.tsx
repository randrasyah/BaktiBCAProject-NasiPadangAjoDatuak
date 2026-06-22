"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "../../lib/supabase-browser";

// Login admin — Supabase Auth (email+password, 1 akun shared, tanpa role tier).
// CLAUDE.md §6.0 / keputusan §2.1.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Bila sudah login, langsung ke dashboard.
  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/orders");
      else setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = getBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email atau kata sandi salah.");
      setSubmitting(false);
      return;
    }
    router.replace("/orders");
  }

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-tan-200 border-t-brown-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* logo-dark di atas latar cream terang (kontras). Wordmark terbaca pada ukuran ini. */}
          <Image
            src="/logo-dark.png"
            alt="Logo Nasi Padang Ajo Datuak"
            width={2000}
            height={2000}
            priority
            className="h-28 w-28 object-contain"
          />
          <p className="mt-2 text-sm font-medium uppercase tracking-widest text-brown-400">Admin</p>
          <p className="mt-1 text-sm text-brown-600">Masuk untuk mengelola pesanan.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-tan-200 bg-cream-100 p-7 shadow-sm"
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-brown-800">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-tan-200 bg-white px-4 py-3 text-brown-900 placeholder:text-brown-400 focus:border-brown-600 focus:outline-none"
              placeholder="admin@ajodatuak.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-brown-800">
              Kata Sandi
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-tan-200 bg-white px-4 py-3 text-brown-900 placeholder:text-brown-400 focus:border-brown-600 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-[#D96C6C]/40 bg-[#D96C6C]/10 px-4 py-2.5 text-sm text-[#9b2c2c]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brown-600 py-3 text-base font-bold text-cream-50 shadow-sm transition-colors hover:bg-brown-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Memproses…" : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
