"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Satu baris keranjang = item + qty + catatan. Baris dengan id & catatan sama digabung.
export interface CartLine {
  key: string; // stabil: `${id}__${note}` — juga mencegah duplikat baris identik
  id: string; // menu_item_id
  name: string;
  price: number; // harga satuan (integer rupiah)
  quantity: number;
  note: string; // "" bila kosong
}

export interface AddItemInput {
  id: string;
  name: string;
  price: number;
  quantity: number;
  note: string;
}

interface CartContextValue {
  lines: CartLine[];
  totalQuantity: number;
  subtotal: number;
  table: string | null;
  setTable: (t: string | null) => void;
  addItem: (item: AddItemInput) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const lineKey = (id: string, note: string) => `${id}__${note.trim()}`;

// State keranjang disimpan di memori (React state) saja — TANPA localStorage
// (sesuai catatan iterasi). Reset saat reload halaman penuh.
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [table, setTable] = useState<string | null>(null);

  const addItem = useCallback((item: AddItemInput) => {
    const note = item.note.trim();
    const key = lineKey(item.id, note);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + item.quantity } : l,
        );
      }
      return [
        ...prev,
        { key, id: item.id, name: item.name, price: item.price, quantity: item.quantity, note },
      ];
    });
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, quantity } : l)),
    );
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totalQuantity = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  );
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    [lines],
  );

  const value = useMemo(
    () => ({
      lines,
      totalQuantity,
      subtotal,
      table,
      setTable,
      addItem,
      updateQuantity,
      removeLine,
      clear,
    }),
    [lines, totalQuantity, subtotal, table, addItem, updateQuantity, removeLine, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart harus dipakai di dalam <CartProvider>");
  return ctx;
}
