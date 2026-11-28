import { Pagination } from './Pagination';
import { useEffect, useRef, useState } from 'react';
import { billingApi, updateSubscription, type ServicePlan, type Subscription } from '../../services/subscriptionApi';
import { CompanyTokenPanel } from './TokenPanels';
import { api } from '../../services/api';
import { AiBillingPanel, PlanPriceCalculator } from './AiBillingPanel';
import { PlanNumberInput } from './PlanNumberInput';


export const tokenDate = (date?: string | null) => date ? new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Không giới hạn';
const localDateInput = (value?: string | null) => value ? new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 10) : '';
const field = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const button = 'rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export function SubscriptionPlans({ subscription, admin = false, onUpdated, view = 'all' }: { subscription?: Subscription; admin?: boolean; onUpdated?: () => void; view?: 'all' | 'plan' | 'accounts' }) {
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [plan, setPlan] = useState<'FREE' | 'PLUS'>('FREE');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [startsAt, setStartsAt] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const receipt = useRef({ signature: '', key: '' });
  useEffect(() => {
    setPlan(subscription?.name ?? 'FREE'); setBillingCycle(subscription?.billingCycle ?? 'MONTHLY');
    setStartsAt(localDateInput(subscription?.startsAt)); setError('');
  }, [subscription?.companyId, subscription?.name, subscription?.billingCycle, subscription?.startsAt, subscription?.endsAt]);
  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    billingApi.plans().then((data) => { if (!cancelled) setPlans(data); }).catch(() => { if (!cancelled) setError('Không thể tải cấu hình gói.'); });
    return () => { cancelled = true; };
  }, [admin, refresh]);
  const save = async () => {
    if (!subscription || saving) return;
    const signature = JSON.stringify([subscription.companyId, plan, billingCycle, startsAt, reason]);
    if (receipt.current.signature !== signature) receipt.current = { signature, key: crypto.randomUUID() };
    setSaving(true); setError('');
    try {
      await updateSubscription(subscription.companyId, plan, billingCycle, null, reason, receipt.current.key, startsAt ? new Date(`${startsAt}T00:00:00+07:00`).toISOString() : undefined);
      setRefresh((v) => v + 1); onUpdated?.();
    } catch { setError('Không thể đổi gói. Kiểm tra ngày bắt đầu và thử lại.'); }
    finally { setSaving(false); }
  };
  if (admin) return <section aria-label="Quản lý gói và token" className="mt-5 space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 className="font-bold">Gói doanh nghiệp và hạn mức token từng tài khoản</h3>
    {view !== 'accounts' && <details className="rounded-lg border bg-white p-4"><summary className="cursor-pointer font-semibold">Cấu hình dịch vụ</summary><div className="mt-4 grid gap-4 xl:grid-cols-2">{plans.map((config) => <PlanEditor key={`${config.name}:${config.version}`} plan={config} onSaved={() => { setRefresh((v) => v + 1); onUpdated?.(); }} />)}</div><AiBillingPanel /></details>}

    {subscription ? <>
      {view !== 'accounts' && <p className="text-sm font-medium">Trạng thái: {subscription.startsAt && new Date(subscription.startsAt) > new Date() ? 'Chưa có hiệu lực' : subscription.endsAt && new Date(subscription.endsAt) <= new Date() ? 'Đã hết hạn' : 'Đang hiệu lực'}</p>}
      {view !== 'accounts' && <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Gói doanh nghiệp<select aria-label="Gói doanh nghiệp" className={field} value={plan} onChange={(e) => setPlan(e.target.value as 'FREE' | 'PLUS')}><option>FREE</option><option>PLUS</option></select></label>
        <label className="text-sm">Chu kỳ thanh toán<select className={field} value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as typeof billingCycle)}><option value="MONTHLY">Theo tháng</option><option value="YEARLY">Theo năm</option></select></label>
        <label className="text-sm">Ngày bắt đầu gói<input aria-label="Ngày bắt đầu gói" className={field} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
        <label className="text-sm">Lý do thay đổi<input aria-label="Lý do đổi gói" className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <button className={button} disabled={saving || reason.trim().length < 3} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu gói doanh nghiệp'}</button>
      </div>}
      {view !== 'plan' && <CompanyTokenPanel key={subscription.companyId} companyId={subscription.companyId} admin refresh={refresh} />}
    </> : <p className="text-sm text-slate-600">Chọn doanh nghiệp ở bộ lọc để gán gói và quản lý token từng HR.</p>}
    {view !== 'accounts' && <BillingAuditPanel refresh={refresh} />}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
  return null;
}

function PlanEditor({ plan, onSaved }: { plan: ServicePlan; onSaved: () => void }) {
  const [draft, setDraft] = useState(plan);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const receipt = useRef({ signature: '', key: '' });
  const save = async () => {
    setSaving(true); setStatus('');
    const signature = JSON.stringify([draft, reason]);
    if (receipt.current.signature !== signature) receipt.current = { signature, key: crypto.randomUUID() };
    try { await billingApi.savePlan(draft, reason, receipt.current.key); onSaved(); }
    catch { setStatus('Không thể lưu cấu hình gói.'); }
    finally { setSaving(false); }
  };
  const fields = [['monthlyPriceVnd', 'Giá dịch vụ / doanh nghiệp / tháng (VND)', 0, 100000000], ['tokenLimit', 'Token mỗi tài khoản', 1000, 1000000000], ['cycleDays', 'Chu kỳ sử dụng (ngày)', 1, 366], ['maxCvPerCall', 'CV mỗi yêu cầu', 1, 200], ['maxOutputTokens', 'Token output tối đa mỗi CV', 1024, 32768]] as const;
  return <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"><h4 className="font-bold">Cấu hình {plan.name} · v{plan.version}</h4>{plan.name === 'PLUS' && <PlanPriceCalculator onApply={(price) => setDraft({ ...draft, monthlyPriceVnd: price })} />}<div className="grid gap-3 sm:grid-cols-2">{fields.map(([key, label, min, max]) => <label key={key} className="text-sm">{label}<PlanNumberInput disabled={key === 'monthlyPriceVnd' && plan.name === 'FREE'} label={`${plan.name} ${label}`} min={min} max={max} value={draft[key] ?? 0} onChange={(value) => setDraft({ ...draft, [key]: value })} /></label>)}</div><label className="block text-sm">Lý do điều chỉnh<input required minLength={3} maxLength={500} className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></label><button disabled={saving} className={button}>Lưu cấu hình {plan.name}</button>{status && <p role="alert" className="text-sm text-red-700">{status}</p>}</form>;
}

const auditActions: Record<string, string> = { PLAN_CONFIG: 'Cập nhật cấu hình gói', PRICE_VERSION: 'Cập nhật đơn giá AI', COMPANY_PLAN: 'Đổi gói doanh nghiệp' };
function auditValues(value: unknown) {
  if (!value || typeof value !== 'object') return [];
  const labels: Record<string, string> = { monthlyPriceVnd: 'Giá / doanh nghiệp / tháng', tokenLimit: 'Token mỗi HR', cycleDays: 'Chu kỳ (ngày)', maxCvPerCall: 'CV mỗi lần chấm', maxOutputTokens: 'Token trả lời tối đa', inputUsd: 'Đơn giá đầu vào (USD/triệu token)', outputUsd: 'Đơn giá đầu ra (USD/triệu token)' };
  return Object.entries(value).flatMap(([key, amount]) => labels[key] && typeof amount === 'number' ? [[labels[key], `${amount.toLocaleString('vi-VN')}${key === 'monthlyPriceVnd' ? 'đ' : ''}`]] : []);
}
export function BillingAuditPanel({ refresh }: { refresh: number }) {
  const [entries, setEntries] = useState<Array<{ id: string; createdAt: string; actorId: string; action: string; targetId: string; reason: string; after: unknown }>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void api.get('/admin/billing-audit', { params: { page }, signal: controller.signal }).then((res) => { if (!controller.signal.aborted) { setEntries(res.data.data); setTotal(res.data.total); setError(''); } }).catch(() => { if (!controller.signal.aborted) setError('Không thể tải sổ thay đổi gói và đơn giá.'); });
    return () => controller.abort();
  }, [page, refresh, open]);
  return <details className="rounded-lg border border-slate-200 bg-white p-4" onToggle={(e) => setOpen(e.currentTarget.open)}><summary className="cursor-pointer font-semibold">Lịch sử thay đổi gói và đơn giá</summary>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {open && !error && total === 0 && <p className="mt-3 text-sm text-slate-500">Chưa có thay đổi.</p>}
    <ul className="mt-3 max-h-80 space-y-3 overflow-auto text-sm">{entries.map((entry) => <li key={entry.id} className="rounded-lg bg-slate-50 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{auditActions[entry.action] ?? 'Cập nhật cấu hình'}{['FREE', 'PLUS'].includes(entry.targetId) ? ` · ${entry.targetId}` : ''}</p><time className="text-xs text-slate-500">{tokenDate(entry.createdAt)}</time></div><p className="mt-1 text-xs text-slate-500">{entry.actorId === 'SYSTEM_MIGRATION' ? 'Hệ thống · Thiết lập giá demo' : 'Quản trị viên'}</p>{entry.actorId !== 'SYSTEM_MIGRATION' && <p className="mt-2 break-words text-slate-600">{entry.reason}</p>}<dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">{auditValues(entry.after).map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-3"><dt className="text-slate-500">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl></li>)}</ul>
    <Pagination page={page} total={total} onChange={setPage} label="Phân trang lịch sử thay đổi" />
  </details>;
}
