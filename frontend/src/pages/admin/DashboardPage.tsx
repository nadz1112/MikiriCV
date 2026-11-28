import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAdminDashboard, type AdminDashboard, type DashboardRange, type EnterpriseActivity } from '../../services/adminDashboardApi';
import { useAutoRefresh } from '../../shared/hooks/useAutoRefresh';
import { Link } from 'react-router-dom';

type SortKey = 'companyName' | 'jobCount' | 'candidateCount' | 'matchCount' | 'tokens' | 'lastLoginAt';
const number = (value: number) => value.toLocaleString('vi-VN');
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

export function AdminDashboardPage() {
  const [range, setRange] = useState<DashboardRange>('7d');
  const [companyId, setCompanyId] = useState('');
  const [period, setPeriod] = useState<{ from: string; to: string }>();
  const [dates, setDates] = useState({ from: '', to: '' });

  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sort] = useState<{ key: SortKey; ascending: boolean }>({ key: 'companyName', ascending: true });
  const requestId = useRef(0);
  const load = useCallback(async (signal: AbortSignal, background = false) => {
    const request = ++requestId.current;
    if (!background) { setLoading(true); setError(''); setData(null); }
    try {
      const response = await getAdminDashboard(range, signal, companyId || undefined, period);
      if (!signal.aborted && request === requestId.current) { setData(response); setError(''); }
    } catch {
      if (!signal.aborted && request === requestId.current) setError('Không thể tải Dashboard quản trị. Vui lòng thử lại.');
    } finally { if (!signal.aborted && request === requestId.current) setLoading(false); }
  }, [range, companyId, period]);
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
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Dashboard quản trị</h1><p className="mt-1 text-sm text-slate-500">Tổng quan dữ liệu và hoạt động AI toàn hệ thống.</p></div>
      <label className="text-sm font-medium">Khoảng thời gian AI <select aria-label="Khoảng thời gian AI" value={range} onChange={(event) => { const value = event.target.value; if (value === '7d' || value === '30d' || value === 'all') { setRange(value); setPeriod(undefined); } }} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="7d">7 ngày</option><option value="30d">30 ngày</option><option value="all">Tất cả</option></select></label>
    </div>
    <form className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 text-sm" onSubmit={(e) => { e.preventDefault(); setPeriod(dates); }}><label className="flex flex-col sm:block gap-1">Từ ngày<input required type="date" className="sm:ml-2 w-full sm:w-auto rounded-lg border p-2" value={dates.from} max={dates.to || undefined} onChange={(e) => setDates({ ...dates, from: e.target.value })} /></label><label className="flex flex-col sm:block gap-1">Đến ngày<input required type="date" className="sm:ml-2 w-full sm:w-auto rounded-lg border p-2" value={dates.to} min={dates.from || undefined} onChange={(e) => setDates({ ...dates, to: e.target.value })} /></label><button className="min-h-[40px] rounded-lg bg-blue-700 px-3 py-2 text-white">Áp dụng</button>{period && <button type="button" className="min-h-[40px] rounded-lg border px-3 py-2" onClick={() => setPeriod(undefined)}>Xóa lọc ngày</button>}</form>
    {loading && <div role="status" className={`${panel} py-12 text-center text-slate-500`}>Đang tải thống kê quản trị…</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{error}<button onClick={() => setRetry((value) => value + 1)} className="ml-3 rounded-lg border border-red-300 px-3 py-1 font-semibold">Thử lại</button></div>}
    {data && <>
      <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Xu hướng sử dụng token</h2><label className="text-sm font-medium">Doanh nghiệp <select aria-label="Doanh nghiệp thống kê AI" value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Tất cả doanh nghiệp</option>{enterprises.filter((enterprise) => enterprise.id !== null).map((enterprise) => <option key={enterprise.id} value={enterprise.id!}>{enterprise.companyName}</option>)}</select></label></div>




        {data.ai.calls === 0 ? <p className="py-12 text-center text-slate-500">Chưa có lịch sử sử dụng AI trong khoảng thời gian này.</p> : <>
          <div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.ai.daily}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line name="Token đầu vào" dataKey="inputTokens" stroke="#2563eb" dot={false}/><Line name="Token đầu ra" dataKey="outputTokens" stroke="#7c3aed" dot={false}/></LineChart></ResponsiveContainer></div>

        </>}
      </section>
      <section className={panel}><h2 className="text-lg font-bold">Gói sắp hết hạn</h2>{enterprises.filter((row) => row.subscription?.endsAt && new Date(row.subscription.endsAt).getTime() >= Date.now() && new Date(row.subscription.endsAt).getTime() <= Date.now() + 7 * 86400000).map((row) => <Link key={row.id} className="mt-3 block text-sm text-amber-700" to={`/admin/companies?companyId=${row.id}`}>{row.companyName} · {new Date(row.subscription!.endsAt!).toLocaleDateString('vi-VN')}</Link>)}{!enterprises.some((row) => row.subscription?.endsAt && new Date(row.subscription.endsAt).getTime() >= Date.now() && new Date(row.subscription.endsAt).getTime() <= Date.now() + 7 * 86400000) && <p className="mt-3 text-sm text-slate-500">Không có gói hết hạn trong 7 ngày tới.</p>}</section>
      <section className={panel}><h2 className="text-lg font-bold">Top doanh nghiệp sử dụng token</h2>
        {enterprises.filter((row) => row.id).sort((a, b) => b.inputTokens + b.outputTokens + (b.thinkingTokens ?? 0) - a.inputTokens - a.outputTokens - (a.thinkingTokens ?? 0)).slice(0, 10).map((row) => {
          const tokens = row.inputTokens + row.outputTokens + (row.thinkingTokens ?? 0);
          const maximum = Math.max(1, ...enterprises.map((item) => item.inputTokens + item.outputTokens + (item.thinkingTokens ?? 0)));
          return <Link key={row.id} to={`/admin/companies?companyId=${row.id}`} className="mt-4 block rounded-lg p-2 hover:bg-blue-50"><div className="mb-1 flex justify-between gap-3 text-sm"><span className="font-medium">{row.companyName}</span><span>{number(tokens)} token</span></div><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${tokens / maximum * 100}%` }} /></div></Link>;
        })}
        {enterprises.length === 0 && <p className="py-8 text-center text-slate-500">Chưa có tài khoản doanh nghiệp.</p>}
      </section>
    </>}
  </div>;
}
