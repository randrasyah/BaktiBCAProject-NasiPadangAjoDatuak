// types.ts — tipe domain bersama, mirror skema DB (CLAUDE.md §8 / supabase/schema.sql).
// Konvensi: kolom timestamptz -> string ISO; kolom nullable -> `| null`.

import { ORDER_STATUSES, MENU_CATEGORIES } from "./constants";

// Union diturunkan dari tuple konstanta agar selalu sinkron.
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type MenuCategory = (typeof MENU_CATEGORIES)[number];

// Mirror tabel menu_items (schema.sql §1.1).
export interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number; // integer rupiah
  is_available: boolean;
  sort_order: number;
  image_url: string | null; // path foto di /public (mis. "/menu/rendang.jpg"); null = placeholder
  created_at: string;
}

// Mirror tabel orders (schema.sql §1.2).
export interface Order {
  id: string;
  order_code: string;
  table_number: string;
  status: OrderStatus;
  subtotal: number; // integer rupiah
  tax: number; // integer rupiah (PB1 10%)
  total: number; // integer rupiah (subtotal + tax = gross_amount Midtrans)
  midtrans_transaction_id: string | null;
  payment_type: string | null;
  paid_at: string | null;
  created_at: string;
  completed_at: string | null;
}

// Mirror tabel order_items (schema.sql §1.3). Snapshot nama & harga saat order.
export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name: string;
  price: number; // integer rupiah, harga satuan saat order
  quantity: number;
  note: string | null;
  created_at: string;
}
