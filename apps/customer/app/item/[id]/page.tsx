import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupiah, type MenuItem } from "@ajo/shared";
import { createAnonClient } from "../../../lib/supabase";
import { FoodImage } from "../../../components/FoodImage";
import { AddToCartForm } from "../../../components/AddToCartForm";
import { ArrowLeftIcon } from "../../../components/icons";

export const dynamic = "force-dynamic";

// Halaman detail generik: bekerja untuk SEMUA item berdasarkan id.
export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let item: MenuItem | null = null;
  try {
    const supabase = createAnonClient();
    const { data } = await supabase.from("menu_items").select("*").eq("id", id).maybeSingle();
    item = (data as MenuItem | null) ?? null;
  } catch {
    item = null;
  }

  if (!item) notFound();

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col pb-32">
      {/* Tombol kembali (melayang di atas foto) */}
      <Link
        href="/"
        aria-label="Kembali ke menu"
        className="absolute left-5 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-brown-800 shadow-sm backdrop-blur transition-colors hover:bg-white"
      >
        <ArrowLeftIcon className="h-5 w-5" />
      </Link>

      {/* Hero foto (atau placeholder bila belum ada) */}
      <FoodImage
        name={item.name}
        src={item.image_url}
        className="h-72 w-full rounded-b-2xl border-b border-tan-200"
        iconClassName="h-16 w-16"
        sizes="(max-width: 480px) 100vw, 480px"
      />

      {/* Detail */}
      <div className="space-y-6 px-5 pb-8 pt-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-brown-800">{item.name}</h1>
          <p className="text-lg font-semibold text-accent">{formatRupiah(item.price)}</p>
        </div>

        <div className="h-px w-full bg-tan-200" />

        <AddToCartForm id={item.id} name={item.name} price={item.price} />
      </div>
    </div>
  );
}
