// Indikator loading transisi antar-route (dipakai Next saat segmen memuat data).
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-tan-200 border-t-brown-600" />
    </div>
  );
}
