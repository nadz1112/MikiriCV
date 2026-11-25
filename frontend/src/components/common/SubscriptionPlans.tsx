import { useEffect, useState } from 'react';
import { updateSubscription, type Subscription } from '../../services/subscriptionApi';

export function SubscriptionPlans({ subscription, admin = false, onUpdated }: { subscription?: Subscription; admin?: boolean; onUpdated?: () => void }) {
  const [plan, setPlan] = useState<'FREE' | 'PLUS'>('FREE');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setPlan(subscription?.name ?? 'FREE');
    setBillingCycle(subscription?.billingCycle ?? 'MONTHLY');
    setError('');
  }, [subscription?.companyId, subscription?.name, subscription?.billingCycle]);
  const save = async () => {
    if (!subscription || saving) return;
    setSaving(true); setError('');
    try { await updateSubscription(subscription.companyId, plan, plan === 'FREE' ? 'MONTHLY' : billingCycle); onUpdated?.(); }
    catch { setError(admin ? 'Không thể cập nhật hạn mức doanh nghiệp. Vui lòng thử lại.' : 'Không thể cập nhật gói dịch vụ. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  };
  if (admin) return <section aria-label="Quản lý hạn mức doanh nghiệp" className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 className="font-bold text-slate-800">Quản lý hạn mức doanh nghiệp</h3>
    {subscription ? <>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">{[
        ['Hạn mức tháng', `${subscription.monthlyLimit} lượt CV`],
        ['Đã sử dụng', `${subscription.used} lượt CV`],
        ['Còn lại', `${subscription.remaining} lượt CV`],
      ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
      <progress aria-label="Lượt CV đã sử dụng trong tháng" max={subscription.monthlyLimit} value={Math.min(subscription.used, subscription.monthlyLimit)} className="mt-3 h-3 w-full accent-blue-700" />
      <p className="mt-2 text-sm text-slate-600">Tháng {subscription.month.slice(0, 7)} · Hạn mức dùng chung cho tất cả HR trong doanh nghiệp. Token đầu vào, đầu ra và chi phí AI thực tế được thống kê riêng ở trên.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Hạn mức phân tích mỗi tháng<select aria-label="Hạn mức phân tích mỗi tháng" disabled={saving} value={plan} onChange={(event) => setPlan(event.target.value as 'FREE' | 'PLUS')} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="FREE">10 lượt CV (FREE)</option><option value="PLUS">300 lượt CV (PLUS)</option></select></label>{plan === 'PLUS' && <label className="text-sm font-medium">Chu kỳ thanh toán<select aria-label="Chu kỳ thanh toán" disabled={saving} value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as 'MONTHLY' | 'YEARLY')} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="MONTHLY">Theo tháng</option><option value="YEARLY">Theo năm</option></select></label>}<button disabled={saving} onClick={() => void save()} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu hạn mức'}</button></div>
      <p className="mt-2 text-sm text-slate-500">Thay đổi áp dụng cho toàn doanh nghiệp và giữ nguyên số lượt đã dùng. Hạn mức làm mới đầu tháng theo giờ Việt Nam; lần chấm lỗi được hoàn lượt.</p>
    </> : <p className="mt-2 text-sm text-slate-600">Chọn doanh nghiệp ở bộ lọc phía trên để xem số lượt đã dùng, còn lại và điều chỉnh hạn mức.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
  return <div className="mt-5 space-y-4">
    {subscription && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Gói {subscription.name} · Hạn mức tháng {subscription.month.slice(0, 7)}</h3><span className="font-semibold">{subscription.used}/{subscription.monthlyLimit} lượt CV · Còn {subscription.remaining} lượt</span></div><progress aria-label="Lượt CV đã sử dụng trong tháng" max={subscription.monthlyLimit} value={Math.min(subscription.used, subscription.monthlyLimit)} className="mt-3 h-3 w-full accent-blue-700"/><p className="mt-2 text-sm text-slate-600">Dùng chung cho mọi HR trong doanh nghiệp. Mỗi CV chấm thành công tính 1 lượt, kể cả chấm lại; lần lỗi được hoàn lượt. Hạn mức làm mới đầu tháng theo giờ Việt Nam.</p><p className="mt-2 text-sm font-semibold">Phí gói: {subscription.name === 'FREE' ? '0đ / mãi mãi' : subscription.billingCycle === 'YEARLY' ? '249.000đ/tháng · 2.988.000đ/năm' : '299.000đ/tháng'}</p></div>}
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-bold">FREE — Trải nghiệm cơ bản</h3><p className="mt-2 text-2xl font-bold">0đ <span className="text-sm font-normal text-slate-500">/ mãi mãi</span></p><p className="mt-2 text-sm text-slate-600">Dành cho cá nhân hoặc doanh nghiệp nhỏ muốn trải nghiệm tốc độ lọc CV bằng AI.</p><ul className="mt-4 list-disc space-y-2 pl-5 text-sm"><li>10 lượt phân tích & chấm điểm CV mỗi tháng.</li><li>CV tiêu chuẩn: tối đa 2 trang PDF / khoảng 3.000 ký tự.</li><li>Chấm điểm mức độ phù hợp theo JD.</li><li>Tóm tắt nhanh 3 điểm nổi bật của ứng viên.</li><li>Xử lý từng CV đơn lẻ.</li></ul></article>
      <article className="rounded-2xl border-2 border-blue-600 bg-blue-50/30 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold">PLUS — Doanh nghiệp & Tuyển dụng chuyên nghiệp</h3><span className="rounded-full bg-blue-700 px-3 py-1 text-sm font-semibold text-white">Khuyên dùng</span></div><p className="mt-2 text-2xl font-bold">299.000đ <span className="text-sm font-normal text-slate-500">/ tháng</span></p><p className="mt-1 text-sm font-semibold text-blue-700">249.000đ/tháng khi thanh toán theo năm · 2.988.000đ/năm</p><p className="mt-2 text-sm text-slate-600">Tối ưu hóa quy trình sàng lọc hàng trăm hồ sơ mỗi đợt tuyển dụng với độ chính xác cao.</p><ul className="mt-4 list-disc space-y-2 pl-5 text-sm"><li>300 lượt phân tích & chấm điểm CV mỗi tháng (~990đ/CV).</li><li>CV dài & Portfolio: tối đa 6 trang PDF / khoảng 12.000 ký tự.</li><li>Phân tích từng kỹ năng và điểm cần xác minh (Red flags).</li><li>Gợi ý câu hỏi phỏng vấn theo lỗ hổng kiến thức của từng ứng viên.</li><li>Tải lên và chấm nhiều CV cho cùng một JD.</li><li>Xuất báo cáo so sánh Excel và in / lưu PDF.</li></ul></article>
    </div>
    <p className="text-sm text-slate-500">PDF được kiểm tra số trang và ký tự; DOCX được kiểm tra số ký tự vì số trang phụ thuộc cách dàn trang. Phân tích dựa trên kỹ năng và kinh nghiệm đã trích xuất; các điểm cần xác minh không phải kết luận về ứng viên.</p>
    <p className="text-sm text-slate-500">Liên hệ quản trị viên để đăng ký hoặc thay đổi gói cho doanh nghiệp.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
