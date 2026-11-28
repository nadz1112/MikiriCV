import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ModalPortal } from '../../../components/common/ModalPortal';
import { getPlanComparison, type PlanComparison } from '../../../services/subscriptionApi';
import { useAccountDialogsStore } from '../accountDialogsStore';

function AccountDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <ModalPortal><div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/50 p-0 sm:p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} className="max-h-[92dvh] w-full max-w-3xl overflow-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:p-7" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const focusable = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
        const first = focusable?.[0], last = focusable?.[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first?.focus(); }
      }
    }}><div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2><button aria-label="Đóng hộp thoại" onClick={onClose} className="min-h-[40px] rounded-lg px-3 py-1 text-slate-600 hover:bg-slate-100">Đóng</button></div>{children}</div>
  </div></ModalPortal>;
}

export function AccountDialogs() {
  const { message, comparisonOpen, compare, close } = useAccountDialogsStore();
  const [plans, setPlans] = useState<PlanComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!comparisonOpen) return;
    const controller = new AbortController(); setLoading(true); setError(''); setPlans([]);
    void getPlanComparison(controller.signal).then((data) => { if (!controller.signal.aborted) setPlans(data); })
      .catch(() => { if (!controller.signal.aborted) setError('Không thể tải thông tin so sánh gói.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [comparisonOpen, retry]);
  if (message) return <AccountDialog title="Thông báo về gói dịch vụ" onClose={close}><p className="text-sm leading-6 text-slate-700">{message}</p><div className="mt-5 flex justify-end"><button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white" onClick={compare}>Xem gói</button></div></AccountDialog>;
  if (!comparisonOpen) return null;
  const free = plans.find((p) => p.name === 'FREE'), plus = plans.find((p) => p.name === 'PLUS');
  const fields = [['Token mỗi tài khoản', 'tokenLimit'], ['Chu kỳ (ngày)', 'cycleDays'], ['CV mỗi yêu cầu', 'maxCvPerCall'], ['Số trang PDF mỗi CV', 'maxPages'], ['Số ký tự mỗi CV', 'maxCharacters']] as const;
  return <AccountDialog title="So sánh gói" onClose={close}>
    <p className="mb-3 text-sm text-slate-600">Cả hai gói đều không giới hạn tài khoản. Phí dịch vụ tính theo doanh nghiệp mỗi tháng; token riêng cho từng HR.</p>
    {!loading && !error && free && plus && <p className="mb-3 text-sm">FREE: {free.monthlyPriceVnd?.toLocaleString('vi-VN') ?? 'Chưa cấu hình'}đ · PLUS: {plus.monthlyPriceVnd?.toLocaleString('vi-VN') ?? 'Chưa cấu hình'}đ / doanh nghiệp / tháng</p>}
    {loading && <p role="status">Đang tải thông tin gói…</p>}
    {error && <p role="alert" className="text-red-700">{error} <button className="underline" onClick={() => setRetry((v) => v + 1)}>Thử lại</button></p>}
    {!loading && !error && (!free || !plus) && <p>Chưa có đủ thông tin so sánh gói.</p>}
    {!loading && !error && free && plus && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Quyền lợi FREE và PLUS theo cấu hình hiện tại</caption><thead className="bg-slate-50"><tr><th className="p-3">Quyền lợi</th><th className="p-3">FREE</th><th className="p-3">PLUS</th></tr></thead><tbody>{fields.map(([label, key]) => <tr className="border-t border-slate-100" key={key}><th scope="row" className="p-3 font-medium">{label}</th><td className="p-3">{free[key].toLocaleString('vi-VN')}</td><td className="p-3 font-semibold text-blue-700">{plus[key].toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>}
    <p className="mt-5 rounded-lg bg-blue-50 p-3 text-sm font-semibold text-blue-900">Liên hệ quản trị viên để nâng cấp gói</p>
  </AccountDialog>;
}
