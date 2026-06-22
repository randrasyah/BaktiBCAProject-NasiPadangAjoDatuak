"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserClient } from "../../lib/supabase-browser";

const NAV = [
  { href: "/orders", label: "Pesanan" },
  { href: "/reports", label: "Laporan" },
] as const;

// Gate auth untuk SEMUA halaman admin (CLAUDE.md §6.0). Belum login -> /login.
// Proteksi sisi-klien cukup di sini karena DATA tetap dijaga RLS (anon tak bisa
// baca orders); ini hanya mencegah UI tampil sebelum sesi terverifikasi.
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setEmail(session.user.email ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  async function logout() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-tan-200 border-t-brown-600" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-tan-200 bg-cream-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              {/* logo-dark di atas header cream (kontras) */}
              <Image
                src="/logo-dark.png"
                alt="Logo Nasi Padang Ajo Datuak"
                width={2000}
                height={2000}
                priority
                className="h-9 w-9 object-contain"
              />
              <span className="rounded-full bg-tan-200 px-2.5 py-0.5 text-xs font-semibold text-brown-800">
                Admin
              </span>
            </div>
            <nav className="flex items-center gap-1">
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-brown-600 text-cream-50"
                        : "text-brown-600 hover:bg-cream-100 hover:text-brown-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {email && <span className="hidden text-sm text-brown-600 sm:inline">{email}</span>}
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border border-tan-200 bg-white px-4 py-2 text-sm font-semibold text-brown-800 transition-colors hover:bg-cream-100"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
