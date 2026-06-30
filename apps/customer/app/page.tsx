import Image from "next/image";
import { MENU_CATEGORIES, CATEGORY_LABELS, type MenuItem } from "@ajo/shared";
import { createAnonClient } from "../lib/supabase";
import { MenuCard } from "../components/MenuCard";
import { CartBar } from "../components/CartBar";
import { TableInitializer } from "../components/TableInitializer";

export const dynamic = "force-dynamic"; // selalu ambil menu terbaru dari Supabase

async function fetchMenu(): Promise<{ items: MenuItem[]; error: string | null }> {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("is_available", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) return { items: [], error: error.message };
    return { items: (data ?? []) as MenuItem[], error: null };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : "Gagal memuat menu." };
  }
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const { table } = await searchParams;
  const tableNumber = table?.trim() || null;
  const { items, error } = await fetchMenu();

  // Kelompokkan per kategori sesuai urutan MENU_CATEGORIES.
  const byCategory = MENU_CATEGORIES.map((category) => ({
    category,
    items: items.filter((it) => it.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-dvh pb-28">
      <TableInitializer table={tableNumber} />

      {/* Header */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-tan-200 bg-white/95 px-5 shadow-sm backdrop-blur">
        <div className="flex items-center gap-2.5">
          {/* logo-dark dipakai di atas header putih (kontras) */}
          <Image
            src="/logo-dark.png"
            alt="Logo Nasi Padang Ajo Datuak"
            width={2000}
            height={2000}
            priority
            className="h-11 w-11 object-contain"
          />
          <h1 className="truncate text-lg font-bold text-brown-800">Nasi Padang Ajo Datuak</h1>
        </div>
        {tableNumber && (
          <span className="rounded-full border border-tan-200 bg-cream-100 px-3 py-1 text-sm font-semibold text-brown-600">
            Meja {tableNumber}
          </span>
        )}
      </header>

      <main className="mx-auto max-w-[480px] px-5 py-8">
        {error ? (
          <EmptyState
            title="Menu belum bisa dimuat"
            body={`${error} — pastikan Supabase sudah di-set di .env.local dan seed menu sudah dijalankan.`}
          />
        ) : byCategory.length === 0 ? (
          <EmptyState
            title="Menu masih kosong"
            body="Belum ada item menu. Jalankan seed di supabase/schema.sql."
          />
        ) : (
          byCategory.map((group) => (
            <section key={group.category} className="mb-8">
              <h2 className="mb-4 border-b border-tan-200 pb-2 text-2xl font-semibold text-brown-800">
                {CATEGORY_LABELS[group.category]}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {group.items.map((item) => (
                  <MenuCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <CartBar />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-12 rounded-2xl border border-tan-200 bg-cream-100 p-8 text-center">
      <h2 className="text-xl font-bold text-brown-800">{title}</h2>
      <p className="mt-2 text-sm text-brown-600">{body}</p>
    </div>
  );
}
