import Image from "next/image";
import { UtensilsIcon } from "./icons";

// Gambar makanan. Bila `src` ada (foto di /public/menu), tampilkan foto asli
// (di-optimasi next/image). Bila null, fallback ke placeholder hangat cream/tan
// + ikon — konsisten tema, tanpa request jaringan. (Lihat CONTEXT.md.)
export function FoodImage({
  name,
  src = null,
  className = "",
  iconClassName = "h-10 w-10",
  sizes = "(max-width: 480px) 50vw, 240px",
}: {
  name: string;
  src?: string | null;
  className?: string;
  iconClassName?: string;
  sizes?: string;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-cream-100 ${className}`}>
        <Image
          src={src}
          alt={`Foto ${name}`}
          fill
          sizes={sizes}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`Foto ${name} (placeholder)`}
      className={`flex items-center justify-center bg-gradient-to-br from-cream-100 to-tan-200 text-brown-400 ${className}`}
    >
      <UtensilsIcon className={iconClassName} />
    </div>
  );
}
