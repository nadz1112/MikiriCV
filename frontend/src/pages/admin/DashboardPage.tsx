import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAdminDashboard, type AdminDashboard, type DashboardRange, type EnterpriseActivity } from '../../services/adminDashboardApi';
import { useAutoRefresh } from '../../shared/hooks/useAutoRefresh';
import { SubscriptionPlans } from '../../components/common/SubscriptionPlans';

type SortKey = 'companyName' | 'jobCount' | 'candidateCount' | 'matchCount' | 'tokens' | 'lastLoginAt';
const number = (value: number) => value.toLocaleString('vi-VN');
const recordedCost = (value?: string | null) => value == null ? 'Chưa xác định' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 10 })} USD`;
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

export function AdminDashboardPage() {
  const [range, setRange] = useState<DashboardRange>('7d');
  const [companyId, setCompanyId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: 'companyName', ascending: true });
  const requestId = useRef(0);
  const load = useCallback(async (signal: AbortSignal, background = false) => {
    const request = ++requestId.current;
    if (!background) { setLoading(true); setError(''); setData(null); }
    try {
      const response = await getAdminDashboard(range, signal, companyId || undefined);
      if (!signal.aborted && request === requestId.current) { setData(response); setError(''); }
    } catch {
      if (!signal.aborted && request === requestId.current) setError('Không thể tải Dashboard quản trị. Vui lòng thử lại.');
    } finally { if (!signal.aborted && request === requestId.current) setLoading(false); }
  }, [range, companyId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, retry]);
  useAutoRefresh((signal) => load(signal, true), !loading);
  const enterprises = useMemo(() => {
    const value = (row: EnterpriseActivity): string | number => {
      if (sort.key === 'tokens') return row.inputTokens + row.outputTokens;
      if (sort.key === 'companyName') return row.companyName || row.fullName;
      if (sort.key === 'lastLoginAt') return row.lastLoginAt ? new Date(row.lastLoginAt).getTime() : 0;
      return row[sort.key];
    };
    return [...(data?.enterprises ?? [])].sort((a, b) => {
      const av = value(a); const bv = value(b);
      const comparison = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv, 'vi') : Number(av) - Number(bv);
      return sort.ascending ? comparison : -comparison;
    });
  }, [data, sort]);
  const changeSort = (key: SortKey) => setSort((current) => ({ key, ascending: current.key === key ? !current.ascending : key === 'companyName' }));
  const expanded = enterprises.find((enterprise) => enterprise.id === expandedId && enterprise.id !== null);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Dashboard quản trị</h1><p className="mt-1 text-sm text-slate-500">Tổng quan dữ liệu và hoạt động AI toàn hệ thống.</p></div>
      <label className="text-sm font-medium">Khoảng thời gian AI <select aria-label="Khoảng thời gian AI" value={range} onChange={(event) => { const value = event.target.value; if (value === '7d' || value === '30d' || value === 'all') setRange(value); }} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="7d">7 ngày</option><option value="30d">30 ngày</option><option value="all">Tất cả</option></select></label>
    </div>
    {loading && <div role="status" className={`${panel} py-12 text-center text-slate-500`}>Đang tải thống kê quản trị…</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{error}<button onClick={() => setRetry((value) => value + 1)} className="ml-3 rounded-lg border border-red-300 px-3 py-1 font-semibold">Thử lại</button></div>}
    {data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Tài khoản', data.overview.totalUsers, `${number(data.overview.activeUsers)} hoạt động · ${number(data.overview.lockedUsers)} bị khóa`],
          ['Job Description', data.overview.totalJobs, 'Toàn hệ thống'],
          ['Hồ sơ CV', data.overview.totalCandidates, `${number(data.overview.failedCandidates)} CV trích xuất thất bại`],
          ['Kết quả matching', data.overview.totalMatches, 'Kết quả mới nhất của từng cặp CV–JD'],
        ].map(([title, value, description]) => <div key={title} className={panel}><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-bold text-blue-700">{number(Number(value))}</p><p className="mt-2 text-xs text-slate-500">{description}</p></div>)}
      </div>
      <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Sử dụng và chi phí AI</h2><label className="text-sm font-medium">Doanh nghiệp <select aria-label="Doanh nghiệp thống kê AI" value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Tất cả doanh nghiệp</option>{enterprises.filter((enterprise) => enterprise.id !== null).map((enterprise) => <option key={enterprise.id} value={enterprise.id!}>{enterprise.companyName}</option>)}</select></label></div><p className="mt-1 text-xs text-slate-500">{data.aiUsageSince ? `Chi phí AI tính từ ${new Date(data.aiUsageSince).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Chưa có dữ liệu sử dụng AI'}. Token được cộng từ tất cả tài khoản HR thuộc doanh nghiệp, trên mọi JD. Thống kê theo khoảng thời gian đã chọn và giờ Việt Nam, gồm các lần chấm lại và lần gọi lỗi; dữ liệu chưa có token không được suy đoán.</p>
        <div className="my-5 grid gap-4 sm:grid-cols-3">{[['Token đầu vào', number(data.ai.inputTokens)], ['Token đầu ra', number(data.ai.outputTokens)], ['Chi phí Gemini đã ghi nhận', recordedCost(data.ai.actualCostUsd)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>
        <div className="my-4 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Token suy luận</p><p className="mt-2 text-xl font-bold">{number(data.ai.thinkingTokens ?? 0)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Chi phí AI đã ghi nhận theo phiên bản đơn giá (USD)</p><p className="mt-2 text-xl font-bold">{recordedCost(data.ai.actualCostUsd)}</p><p className="mt-1 text-xs text-slate-500">{data.ai.callsWithoutPrice ?? 0} lần gọi chưa xác định chi phí; tổng trên có thể chưa đầy đủ.</p></div></div>
        <SubscriptionPlans admin subscription={enterprises.find((enterprise) => enterprise.id === companyId)?.subscription} onUpdated={() => setRetry((value) => value + 1)} />
        <p className="text-xs text-slate-500">{number(data.ai.calls)} lần gọi · {number(data.ai.callsWithoutTokenData)} lần chưa có đủ dữ liệu token. Tổng chi phí lấy từ đơn giá đã lưu cho từng lần gọi, không tính lại lịch sử bằng giá hiện tại và không cộng tiền mô phỏng.</p>
        {data.ai.calls === 0 ? <p className="py-12 text-center text-slate-500">Chưa có lịch sử sử dụng AI trong khoảng thời gian này.</p> : <>
          <div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.ai.daily}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line name="Token đầu vào" dataKey="inputTokens" stroke="#2563eb" dot={false}/><Line name="Token đầu ra" dataKey="outputTokens" stroke="#7c3aed" dot={false}/></LineChart></ResponsiveContainer></div>
          {<div className="mt-5 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.ai.daily.map((day) => ({ ...day, actualCostUsd: day.actualCostUsd == null ? null : Number(day.actualCostUsd) }))}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Bar name="Chi phí Gemini đã ghi nhận (USD)" dataKey="actualCostUsd" fill="#0d9488"/></BarChart></ResponsiveContainer></div>}
        </>}
      </section>
      <section className={panel}><h2 className="text-lg font-bold">Hoạt động theo doanh nghiệp</h2><p className="mt-1 text-xs text-slate-500">JD, CV và kết quả matching là tổng hiện có của các HR; token theo khoảng thời gian AI đã chọn. Bấm tên doanh nghiệp để xem các tài khoản HR. Bấm tiêu đề cột để sắp xếp.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{([
          ['companyName', 'Doanh nghiệp'], ['jobCount', 'JD'], ['candidateCount', 'CV'], ['matchCount', 'Matching'], ['tokens', 'Token đã dùng'], ['lastLoginAt', 'Đăng nhập cuối'],
        ] as const).map(([key, label]) => <th key={key} aria-sort={sort.key === key ? sort.ascending ? 'ascending' : 'descending' : 'none'} className="px-4 py-3"><button onClick={() => changeSort(key)} className="font-semibold">{label}{sort.key === key ? sort.ascending ? ' ↑' : ' ↓' : ' ↕'}</button></th>)}<th className="px-4 py-3">Lượt gọi AI</th><th className="px-4 py-3">Chi phí Gemini (USD)</th></tr></thead><tbody>
          {enterprises.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">Chưa có tài khoản doanh nghiệp.</td></tr> : enterprises.map((row) => <tr key={row.id ?? 'deleted-accounts'} className="border-t border-slate-100"><td className="px-4 py-3">{row.id ? <button aria-expanded={expandedId === row.id} aria-controls="company-hr-details" onClick={() => setExpandedId((current) => current === row.id ? null : row.id)} className="text-left font-semibold text-blue-700 hover:underline">{row.companyName || 'Chưa có tên công ty'}</button> : <div className="font-medium">{row.companyName}</div>}<div className="text-xs text-slate-500">{row.hrCount} tài khoản HR</div></td><td className="px-4 py-3">{number(row.jobCount)}</td><td className="px-4 py-3">{number(row.candidateCount)}</td><td className="px-4 py-3">{number(row.matchCount)}</td><td className="px-4 py-3">{number(row.inputTokens + row.outputTokens)}</td><td className="px-4 py-3">{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa đăng nhập'}</td><td className="px-4 py-3">{number(row.calls)}</td><td className="px-4 py-3">{recordedCost(row.actualCostUsd)}{row.subscription && <div className="mt-1 text-xs font-medium text-blue-700">{row.subscription.name} · {number(row.subscription.tokenLimit)} token / HR / {row.subscription.cycleDays} ngày</div>}</td></tr>)}
        </tbody></table></div>
        {expanded && <section id="company-hr-details" aria-label={`HR thuộc ${expanded.companyName}`} className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">Tài khoản HR · {expanded.companyName}</h3><button onClick={() => setExpandedId(null)} className="text-sm font-semibold text-blue-700">Thu gọn</button></div><p className="mt-1 text-sm text-slate-500">{expanded.hrCount} tài khoản. Token là lịch sử phát sinh tại doanh nghiệp này trong khoảng thời gian đã chọn, kể cả các HR đã xóa.</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead><tr>{['Họ tên HR', 'Email', 'Trạng thái', 'JD', 'CV', 'Matching', 'Token đầu vào', 'Token đầu ra', 'Lượt gọi AI'].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr></thead><tbody>{expanded.members.length === 0 ? <tr><td colSpan={9} className="p-4 text-center text-slate-500">Chưa có tài khoản HR.</td></tr> : expanded.members.map((hr) => <tr key={hr.id} className="border-t border-blue-100"><td className="px-3 py-3 font-medium">{hr.fullName}</td><td className="px-3 py-3">{hr.email}</td><td className="px-3 py-3">{hr.isActive ? 'Hoạt động' : 'Đã khóa'}</td><td className="px-3 py-3">{number(hr.jobCount)}</td><td className="px-3 py-3">{number(hr.candidateCount)}</td><td className="px-3 py-3">{number(hr.matchCount)}</td><td className="px-3 py-3">{number(hr.inputTokens)}</td><td className="px-3 py-3">{number(hr.outputTokens)}</td><td className="px-3 py-3">{number(hr.calls)}</td></tr>)}</tbody></table></div></section>}
      </section>
    </>}
  </div>;
}
