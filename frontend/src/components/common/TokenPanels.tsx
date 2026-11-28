import { Pagination } from './Pagination';
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { billingApi, type CompanyTokens, type TokenHistory } from '../../services/subscriptionApi';
import { useAutoRefresh } from '../../shared/hooks/useAutoRefresh';
import { useIsMobileViewport } from '../../shared/hooks/useIsMobileViewport';
import { useNetworkStore } from '../../shared/offline/networkStore';

const number = (n: number) => n.toLocaleString('vi-VN');
const date = (v: string) => new Date(v).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const input = 'mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2';
const button = 'rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50';

export function CompanyTokenPanel({ companyId, admin = false, refresh = 0 }: { companyId: string; admin?: boolean; refresh?: number }) {
  const isMobile = useIsMobileViewport();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const [data, setData] = useState<CompanyTokens>();
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false; setData(undefined);
    billingApi.company(companyId).then((value) => { if (!cancelled) { setData(value); setError(''); } }).catch(() => { if (!cancelled) setError('Không thể tải token doanh nghiệp.'); });
    return () => { cancelled = true; };
  }, [companyId, refresh, version]);
  useEffect(() => { setSelected(''); }, [companyId]);
  const changeStatus = async (isActive: boolean) => {
    if (!checked.length || !window.confirm(`${isActive ? 'Mở khóa' : 'Khóa'} ${checked.length} tài khoản đã chọn?`)) return;
    setSaving(true); setError('');
    try {
      for (const id of checked) await api.patch(`/users/${encodeURIComponent(id)}/status`, { isActive });
      setChecked([]);
    } catch { setError('Một số tài khoản chưa cập nhật được. Kiểm tra trạng thái và thử lại.'); }
    finally { setSaving(false); setVersion((value) => value + 1); }
  };
  useAutoRefresh(async (signal) => { try { const value = await billingApi.company(companyId); if (!signal.aborted) { setData(value); setError(''); } } catch { if (!signal.aborted) setError('Không thể làm mới token doanh nghiệp.'); } }, !saving);
  return <section aria-label="Token các tài khoản doanh nghiệp" className="rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="font-bold">Token các tài khoản · {data?.companyName ?? 'Doanh nghiệp'}</h3>
    {admin && <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-sm">Đã chọn {checked.length}</span><button disabled={!isOnline || saving || !checked.length} className={button} onClick={() => void changeStatus(false)}>Khóa tài khoản</button><button disabled={!isOnline || saving || !checked.length} className={button} onClick={() => void changeStatus(true)}>Mở khóa</button></div>}

    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {data && (isMobile ? (
      <div className="mt-3 space-y-2.5">
        {data.accounts.map((account) => (
          <div key={account.id} className="rounded-lg border border-slate-200 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 font-semibold text-slate-900">
                {admin && <input aria-label={`Chọn ${account.fullName}`} type="checkbox" checked={checked.includes(account.id)} onChange={(e) => setChecked((ids) => e.target.checked ? [...ids, account.id] : ids.filter((id) => id !== account.id))} />}
                <span>{account.fullName}</span>
              </label>
              {!account.isActive && <span className="text-red-700 font-semibold">Đã khóa</span>}
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-600">
              <span>Hạn mức: <strong>{number(account.quota.tokenLimit)}</strong></span>
              <span>Còn lại: <strong>{number(account.quota.remaining)}</strong></span>
              <span>Đã dùng: <strong>{number(account.quota.used)}</strong></span>
              <span>Tạm giữ: <strong>{number(account.quota.reservedTokens)}</strong></span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400">Hết chu kỳ: {date(account.quota.periodEnd)}</span>
              {admin && <button className="font-semibold text-blue-700" onClick={() => setSelected(account.id)}>Lịch sử</button>}
            </div>
          </div>
        ))}
        {data.accounts.length === 0 && <p className="py-4 text-sm text-slate-500">Chưa có tài khoản HR.</p>}
      </div>
    ) : (
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Tài khoản', 'Hạn mức', 'Đã dùng', 'Tạm giữ', 'Còn lại', 'Kết thúc chu kỳ', ...(admin ? ['Thao tác'] : [])].map((v) => <th key={v} className="px-3 py-2" title={v === 'Tạm giữ' ? 'Token dành trước cho yêu cầu AI, chưa phải số đã dùng. Phần dư được trả lại khi xác định mức sử dụng thực tế.' : undefined}>{v}</th>)}</tr></thead><tbody>{data.accounts.map((account) => <tr key={account.id} className="border-t border-slate-100"><td className="px-3 py-2">{admin && <input aria-label={`Chọn ${account.fullName}`} type="checkbox" className="mr-2" checked={checked.includes(account.id)} onChange={(e) => setChecked((ids) => e.target.checked ? [...ids, account.id] : ids.filter((id) => id !== account.id))} />}{account.fullName}{!account.isActive && <span className="ml-1 text-xs text-red-700">Đã khóa</span>}</td>{[account.quota.tokenLimit, account.quota.used, account.quota.reservedTokens, account.quota.remaining].map((v, i) => <td key={i} className="px-3 py-2">{number(v)}</td>)}<td className="px-3 py-2">{date(account.quota.periodEnd)}</td>{admin && <td className="px-3 py-2"><button className="font-semibold text-blue-700" onClick={() => { setSelected(account.id); }}>Lịch sử</button></td>}</tr>)}</tbody></table>{data.accounts.length === 0 && <p className="py-4 text-sm text-slate-500">Chưa có tài khoản HR.</p>}</div>
    ))}
    {admin && selected && <div className="mt-4 space-y-4 rounded-lg bg-slate-50 p-4"><h4 className="font-semibold">{data?.accounts.find((v) => v.id === selected)?.fullName}</h4><TokenHistoryPanel userId={selected} refresh={version} onReconciled={() => setVersion((v) => v + 1)} /></div>}
  </section>;
}

export function TokenHistoryPanel({ userId, refresh = 0, onReconciled }: { userId: string; refresh?: number; onReconciled?: () => void }) {
  const isOnline = useNetworkStore((state) => state.isOnline);
  const [data, setData] = useState<TokenHistory>();
  const [page, setPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [reservationPage, setReservationPage] = useState(1);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState('');
  const [action, setAction] = useState('settle');
  const [reason, setReason] = useState('');
  const [counts, setCounts] = useState({ input: '', output: '', thinking: '0' });
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => { setPage(1); setLedgerPage(1); setReservationPage(1); setReservation(''); }, [userId]);
  useEffect(() => {
    const controller = new AbortController(); setData(undefined);
    billingApi.history(userId, page, controller.signal, ledgerPage, reservationPage).then((value) => { if (!controller.signal.aborted) { setData(value); setError(''); } }).catch(() => { if (!controller.signal.aborted) setError('Không thể tải lịch sử token.'); });
    return () => controller.abort();
  }, [userId, page, ledgerPage, reservationPage, refresh, version]);
  useEffect(() => {
    if (!data) return;
    setPage((value) => Math.min(value, Math.max(1, Math.ceil(data.usageTotal / 10))));
    setLedgerPage((value) => Math.min(value, Math.max(1, Math.ceil(data.ledgerTotal / 10))));
    setReservationPage((value) => Math.min(value, Math.max(1, Math.ceil(data.reservationTotal / 10))));
  }, [data]);
  return <details className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold">Lịch sử token và chi phí AI {userId ? 'của tài khoản' : 'cá nhân'}</summary>
    {!data && !error && <p role="status" className="mt-2 text-sm text-slate-500">Đang tải lịch sử…</p>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {data && <div className="mt-3 space-y-4">
      {data.reservationTotal > 0 && <details className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Cần đối soát</summary><p>Xác minh các lần gọi chưa rõ mức sử dụng để chốt token thực tế hoặc hoàn phần tạm giữ khi xác nhận AI chưa xử lý.</p>{data.reservations.map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2"><span>{date(r.createdAt)} · {r.model} · {number(r.amount)} token · {r.status === 'UNKNOWN' ? 'Chưa xác định kết quả' : r.status === 'STARTED' ? 'Đã gửi yêu cầu' : 'Đang giữ token'}</span>{userId && (r.status === 'UNKNOWN' || (['STARTED', 'HELD'].includes(r.status) && Date.now() - new Date(r.createdAt).getTime() > 600000)) && <button className="text-blue-700" onClick={() => setReservation(r.id)}>Đối soát</button>}</div>)}<Pagination page={reservationPage} total={data.reservationTotal} onChange={setReservationPage} label="Phân trang đối soát" /></details>}
      {reservation && userId && <form className="flex flex-wrap items-end gap-3 rounded-lg border p-3 text-sm" onSubmit={(e) => {
        e.preventDefault(); setSaving(true); setError('');
        void api.post(`/admin/reservations/${encodeURIComponent(reservation)}/reconcile`, { action, reason, inputTokens: Number(counts.input), outputTokens: Number(counts.output), thinkingTokens: Number(counts.thinking) }).then(() => { setReservation(''); setVersion((v) => v + 1); onReconciled?.(); }).catch(() => setError('Không thể đối soát lần gọi này.')).finally(() => setSaving(false));
      }}><label>Kết quả<select className={input} value={action} onChange={(e) => setAction(e.target.value)}><option value="settle">Quyết toán token thực tế</option><option value="release">Xác nhận AI chưa xử lý — hoàn tạm giữ</option></select></label>{action === 'settle' && (['input', 'output', 'thinking'] as const).map((key) => <label key={key}>{{ input: 'Token đầu vào', output: 'Token trả lời', thinking: 'Token suy luận' }[key]}<input required type="number" min="0" max="1000000000" className={`${input} w-32`} value={counts[key]} onChange={(e) => setCounts({ ...counts, [key]: e.target.value })} /></label>)}<label>Bằng chứng / lý do<input required minLength={3} className={input} value={reason} onChange={(e) => setReason(e.target.value)} /></label><button className={button} disabled={!isOnline || saving}>Xác nhận đối soát</button></form>}
      <h4 className="font-semibold">Lịch sử sử dụng AI</h4><div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{['Thời gian', 'Token sử dụng', 'Chu kỳ', 'Kết quả'].map((label) => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{data.usage.map((entry) => <tr key={entry.id} className="border-t"><td className="p-2">{date(entry.createdAt)}</td><td className="p-2">{entry.totalTokens == null ? 'Chờ xác định' : number(entry.totalTokens)}</td><td className="p-2">{entry.period ? `${date(entry.period.periodStart)} → ${date(entry.period.periodEnd)}` : 'Chưa có dữ liệu chu kỳ'}</td><td className="p-2">{entry.succeeded ? 'Thành công' : 'Thất bại / Chờ đối soát'}</td></tr>)}</tbody></table></div>
      <Pagination page={page} total={data.usageTotal} onChange={setPage} label="Phân trang sử dụng AI" />
      <details><summary className="cursor-pointer font-semibold">Lịch sử hạn mức và chu kỳ</summary><div className="overflow-auto"><table className="mt-3 w-full text-left text-sm"><thead><tr>{['Thời gian', 'Thao tác', 'Token', 'Kết thúc chu kỳ'].map((label) => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{data.ledger.map((entry) => <tr key={entry.id} className="border-t"><td className="p-2">{date(entry.createdAt)}</td><td className="p-2">{entry.kind === 'GRANT' ? 'Bắt đầu chu kỳ' : entry.kind === 'PLAN_CHANGE' ? 'Thay đổi gói' : 'Điều chỉnh trước đây'}</td><td className="p-2">{number(entry.amount)}</td><td className="p-2">{entry.wallet ? date(entry.wallet.periodEnd) : 'Chưa xác định'}</td></tr>)}</tbody></table></div><Pagination page={ledgerPage} total={data.ledgerTotal} onChange={setLedgerPage} label="Phân trang hạn mức và chu kỳ" /></details>      {data.usage.length === 0 && data.ledger.length === 0 && <p className="text-sm text-slate-500">Chưa có lịch sử sử dụng.</p>}

    </div>}
  </details>;
}
