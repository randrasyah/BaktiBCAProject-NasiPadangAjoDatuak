import { redirect } from "next/navigation";

// Root admin -> dashboard pesanan. (protected) layout akan mengalihkan ke
// /login bila belum terautentikasi.
export default function Home() {
  redirect("/orders");
}
