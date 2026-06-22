"use client";

import { MinusIcon, PlusIcon } from "./icons";

// Selektor jumlah (− / angka / +), minimal `min` (default 1). Komponen reusable.
export function QuantitySelector({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label="Kurangi"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-tan-200 bg-cream-100 text-brown-600 transition-colors hover:bg-tan-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <MinusIcon className="h-5 w-5" />
      </button>
      <span className="w-6 text-center text-xl font-semibold text-brown-800" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Tambah"
        onClick={() => onChange(value + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brown-600 text-cream-50 shadow-sm transition-colors hover:bg-brown-800"
      >
        <PlusIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
