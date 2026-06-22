"use client";

import { useEffect } from "react";
import { useCart } from "../lib/cart";

// Menyimpan nomor meja dari query param `?table=NN` ke cart context,
// agar bisa dipakai di checkout (iterasi berikutnya). Tidak merender apa pun.
export function TableInitializer({ table }: { table: string | null }) {
  const { setTable } = useCart();
  useEffect(() => {
    if (table) setTable(table);
  }, [table, setTable]);
  return null;
}
