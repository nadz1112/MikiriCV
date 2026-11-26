import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { billingApi, type CompanyTokens, type TokenHistory } from '../../services/subscriptionApi';
import { useAutoRefresh } from '../../shared/hooks/useAutoRefresh';

const number = (n: number) => n.toLocaleString('vi-VN');
const date = (v: string) => new Date(v).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const input = 'mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2';
const button = 'rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50';

export function CompanyTokenPanel({ companyId, admin = false, refresh = 0 }: { companyId: string; admin?: boolean; refresh?: number }) {
  const [data, setData] = useState<CompanyTokens>();
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  const receipt = useRef({ signature: '', key: '' });
  useEffect(() => {
    let cancelled = false; setData(undefined);
    billingApi.company(companyId).then((value) => { if (!cancelled) { setData(value); setError(''); } }).catch(() => { if (!cancelled) setError('Không thể tải token doanh nghiệp.'); });
    return () => { cancelled = true; };
  }, [companyId, refresh, version]);
  useEffect(() => { setSelected(''); }, [companyId]);
  useAutoRefresh(async (signal) => { try { const value = await billingApi.company(companyId); if (!signal.aborted) { setData(value); setError(''); } } catch { if (!signal.aborted) setError('Không thể làm mới token doanh nghiệp.'); } }, !saving);
  const adjust = async () => {
    const signature = JSON.stringify([selected, amount, reason]);
    if (receipt.current.signature !== signature) receipt.current = { signature, key: crypto.randomUUID() };
    setSaving(true); setError('');
    try {
      await api.post(`/admin/users/${encodeURIComponent(selected)}/tokens`, { amount: Number(amount), reason, operationKey: receipt.current.key });
      setVersion((v) => v + 1); setAmount(''); setReason('');
    } catch { setError('Không thể điều chỉnh token. Không thể thu hồi token đã dùng hoặc đang tạm giữ.'); }
    finally { setSaving(false); }
  };
  return <section aria-label="Token các tài khoản doanh nghiệp" className="rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="font-bold">Token các tài khoản · {data?.companyName ?? 'Doanh nghiệp'}</h3>
    <p className="mt-2 text-sm text-slate-600">Mỗi tài khoản có số dư riêng. Một HR hết token không ảnh hưởng đến HR khác.</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {data && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Tài khoản', 'Hạn mức', 'Đã dùng', 'Tạm giữ', 'Còn lại', 'Kết thúc chu kỳ', ...(admin ? ['Thao tác'] : [])].map((v) => <th key={v} className="px-3 py-2">{v}</th>)}</tr></thead><tbody>{data.accounts.map((account) => <tr key={account.id} className="border-t border-slate-100"><td className="px-3 py-2">{account.fullName}{!account.isActive && <span className="ml-1 text-xs text-red-700">Đã khóa</span>}</td>{[account.quota.tokenLimit, account.quota.used, account.quota.reservedTokens, account.quota.remaining].map((v, i) => <td key={i} className="px-3 py-2">{number(v)}</td>)}<td className="px-3 py-2">{date(account.quota.periodEnd)}</td>{admin && <td className="px-3 py-2"><button className="font-semibold text-blue-700" onClick={() => { setSelected(account.id); setAmount(''); setReason(''); }}>Điều chỉnh / Lịch sử</button></td>}</tr>)}</tbody></table>{data.accounts.length === 0 && <p className="py-4 text-sm text-slate-500">Chưa có tài khoản HR.</p>}</div>}
    {admin && selected && <div className="mt-4 space-y-4 rounded-lg bg-slate-50 p-4"><h4 className="font-semibold">{data?.accounts.find((v) => v.id === selected)?.fullName}</h4><form className="flex flex-wrap items-end gap-3 text-sm" onSubmit={(e) => { e.preventDefault(); void adjust(); }}><label>Token điều chỉnh (+ cấp thêm / − thu hồi)<input required aria-label="Token điều chỉnh" type="number" min="-1000000000" max="1000000000" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} /></label><label>Lý do đối soát<input required minLength={3} maxLength={500} aria-label="Lý do điều chỉnh token" className={input} value={reason} onChange={(e) => setReason(e.target.value)} /></label><button disabled={saving || !Number(amount)} className={button}>Ghi sổ điều chỉnh</button></form><TokenHistoryPanel userId={selected} refresh={version} onReconciled={() => setVersion((v) => v + 1)} /></div>}
  </section>;
}

export function TokenHistoryPanel({ userId, refresh = 0, onReconciled }: { userId: string; refresh?: number; onReconciled?: () => void }) {
  const [data, setData] = useState<TokenHistory>();
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState('');
  const [action, setAction] = useState('settle');
  const [reason, setReason] = useState('');
  const [counts, setCounts] = useState({ input: '', output: '', thinking: '0' });
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => { setPage(1); setReservation(''); }, [userId]);
  useEffect(() => {
    const controller = new AbortController(); setData(undefined);
    billingApi.history(userId, page, controller.signal).then((value) => { if (!controller.signal.aborted) { setData(value); setError(''); } }).catch(() => { if (!controller.signal.aborted) setError('Không thể tải lịch sử token.'); });
    return () => controller.abort();
  }, [userId, page, refresh, version]);
  return <details className="rounded-lg border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold">Lịch sử token và chi phí AI {userId ? 'của tài khoản' : 'cá nhân'}</summary>
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {data && <div className="mt-3 space-y-4">
      {data.reservations.length > 0 && <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm"><h4 className="font-semibold">Token tạm giữ / chờ đối soát</h4>{data.reservations.map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2"><span>{date(r.createdAt)} · {r.model} · {number(r.amount)} token · {r.status}</span>{userId && (r.status === 'UNKNOWN' || (['STARTED', 'HELD'].includes(r.status) && Date.now() - new Date(r.createdAt).getTime() > 600000)) && <button className="text-blue-700" onClick={() => setReservation(r.id)}>Đối soát</button>}</div>)}<p>Lần gọi chưa rõ kết quả tiếp tục giữ token cho đến khi xác minh với provider.</p></div>}
      {reservation && userId && <form className="flex flex-wrap items-end gap-3 rounded-lg border p-3 text-sm" onSubmit={(e) => {
        e.preventDefault(); setSaving(true); setError('');
        void api.post(`/admin/reservations/${encodeURIComponent(reservation)}/reconcile`, { action, reason, inputTokens: Number(counts.input), outputTokens: Number(counts.output), thinkingTokens: Number(counts.thinking) }).then(() => { setReservation(''); setVersion((v) => v + 1); onReconciled?.(); }).catch(() => setError('Không thể đối soát lần gọi này.')).finally(() => setSaving(false));
      }}><label>Kết quả<select className={input} value={action} onChange={(e) => setAction(e.target.value)}><option value="settle">Quyết toán token thực tế</option><option value="release">Provider xác nhận không xử lý — hoàn tạm giữ</option></select></label>{action === 'settle' && (['input', 'output', 'thinking'] as const).map((key) => <label key={key}>{key}<input required type="number" min="0" max="1000000000" className={`${input} w-32`} value={counts[key]} onChange={(e) => setCounts({ ...counts, [key]: e.target.value })} /></label>)}<label>Bằng chứng / lý do<input required minLength={3} className={input} value={reason} onChange={(e) => setReason(e.target.value)} /></label><button className={button} disabled={saving}>Xác nhận đối soát</button></form>}
      <div className="overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['Thời gian', 'Model', 'Input', 'Output', 'Thinking', 'Tổng token', 'Chi phí USD', 'Phiên bản giá', 'Kết quả'].map((v) => <th className="px-2 py-2" key={v}>{v}</th>)}</tr></thead><tbody>{data.usage.map((u) => <tr key={u.id} className="border-t border-slate-100"><td className="px-2 py-2">{date(u.createdAt)}</td><td className="px-2 py-2">{u.model}</td>{[u.inputTokens, u.outputTokens, u.thinkingTokens, u.totalTokens].map((v, i) => <td className="px-2 py-2" key={i}>{v == null ? 'Chưa rõ' : number(v)}</td>)}<td className="px-2 py-2">{u.actualCostUsd ?? 'Chưa có đơn giá'}</td><td className="max-w-32 break-all px-2 py-2">{u.priceVersion ?? 'Chưa cấu hình'}</td><td className="px-2 py-2">{u.succeeded ? 'Thành công' : 'Thất bại / đối soát'}</td></tr>)}</tbody></table></div>
      <h4 className="font-semibold">Sổ cái token</h4><div className="max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Thời gian</th><th className="p-2">Loại</th><th className="p-2">Token</th><th className="p-2">Lý do</th></tr></thead><tbody>{data.ledger.map((entry) => <tr key={entry.id} className="border-t border-slate-100"><td className="p-2">{date(entry.createdAt)}</td><td className="p-2">{entry.kind}</td><td className="p-2">{number(entry.amount)}</td><td className="p-2">{entry.reason}</td></tr>)}</tbody></table></div>
      {data.usage.length === 0 && data.ledger.length === 0 && <p className="text-sm text-slate-500">Chưa có lịch sử sử dụng.</p>}
      <div className="flex items-center gap-3 text-sm"><button className={button} disabled={page === 1} onClick={() => setPage((v) => v - 1)}>Trước</button><span>Trang {page}</span><button className={button} disabled={page * data.pageSize >= Math.max(data.usageTotal, data.ledgerTotal)} onClick={() => setPage((v) => v + 1)}>Sau</button></div>
    </div>}
  </details>;
}
