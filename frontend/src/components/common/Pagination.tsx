export function Pagination({ page, total, onChange, label }: { page: number; total: number; onChange: (page: number) => void; label: string }) {
  if (total <= 10) return null;
  const pages = Math.ceil(total / 10);
  return <nav aria-label={label} className="mt-3 flex items-center gap-3 text-sm"><button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</button><span>Trang {page} / {pages} · {total} mục</span><button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau</button></nav>;
}
