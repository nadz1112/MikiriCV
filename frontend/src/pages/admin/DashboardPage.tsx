import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAdminDashboard, type AdminDashboard, type DashboardRange, type EnterpriseActivity } from '../../services/adminDashboardApi';

type SortKey = 'companyName' | 'jobCount' | 'candidateCount' | 'matchCount' | 'tokens' | 'lastLoginAt';
const number = (value: number) => value.toLocaleString('vi-VN');
const cost = (value: number | null) => value === null ? 'Chưa cấu hình đơn giá' : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 6 })} USD`;
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

export function AdminDashboardPage() {
  const [range, setRange] = useState<DashboardRange>('7d');
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: 'companyName', ascending: true });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    void getAdminDashboard(range, controller.signal).then((response) => {
      if (!controller.signal.aborted) setData(response);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Không thể tải Dashboard quản trị. Vui lòng thử lại.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [range, retry]);
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
      <section className={panel}><h2 className="text-lg font-bold">Phân bổ điểm toàn hệ thống</h2><p className="mt-1 text-xs text-slate-500">Các khoảng phân bố: &lt;50, 50–70 (gồm 70), &gt;70–85, &gt;85. Các mốc này khác ngưỡng badge màu điểm AI (50 và 80).</p>
        {data.overview.totalMatches === 0 ? <p className="py-12 text-center text-slate-500">Chưa có kết quả matching.</p> : <div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.distribution}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label"/><YAxis allowDecimals={false}/><Tooltip/><Bar name="Số kết quả" dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]}/></BarChart></ResponsiveContainer></div>}
      </section>
      <section className={panel}><h2 className="text-lg font-bold">Sử dụng và chi phí AI</h2><p className="mt-1 text-xs text-slate-500">Theo khoảng thời gian đã chọn, tính ngày theo giờ Việt Nam. Cộng các lần gọi từ khi bật ghi lịch sử, bao gồm chấm lại; dữ liệu cũ chưa có token không được suy đoán.</p>
        <div className="my-5 grid gap-4 sm:grid-cols-3">{[['Token đầu vào', number(data.ai.inputTokens)], ['Token đầu ra', number(data.ai.outputTokens)], ['Chi phí ước tính', cost(data.ai.estimatedCostUsd)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>
        <p className="text-xs text-slate-500">{number(data.ai.calls)} lần gọi · {number(data.ai.callsWithoutTokenData)} lần chưa có đủ dữ liệu token. Ước tính dựa trên token đã biết và đơn giá hiện tại: đầu vào {data.ai.inputRate ?? 'chưa cấu hình'}, đầu ra {data.ai.outputRate ?? 'chưa cấu hình'} USD/triệu token.</p>
        {data.ai.calls === 0 ? <p className="py-12 text-center text-slate-500">Chưa có lịch sử sử dụng AI trong khoảng thời gian này.</p> : <>
          <div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.ai.daily}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis allowDecimals={false}/><Tooltip/><Legend/><Line name="Token đầu vào" dataKey="inputTokens" stroke="#2563eb" dot={false}/><Line name="Token đầu ra" dataKey="outputTokens" stroke="#7c3aed" dot={false}/></LineChart></ResponsiveContainer></div>
          {data.ai.estimatedCostUsd !== null && <div className="mt-5 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.ai.daily}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Bar name="Chi phí ước tính (USD)" dataKey="estimatedCostUsd" fill="#0d9488"/></BarChart></ResponsiveContainer></div>}
        </>}
      </section>
      <section className={panel}><h2 className="text-lg font-bold">Hoạt động theo doanh nghiệp</h2><p className="mt-1 text-xs text-slate-500">JD, CV và kết quả matching là tổng hiện có; token theo khoảng thời gian AI đã chọn. Bấm tiêu đề cột để sắp xếp.</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{([
          ['companyName', 'Doanh nghiệp'], ['jobCount', 'JD'], ['candidateCount', 'CV'], ['matchCount', 'Matching'], ['tokens', 'Token đã dùng'], ['lastLoginAt', 'Đăng nhập cuối'],
        ] as const).map(([key, label]) => <th key={key} aria-sort={sort.key === key ? sort.ascending ? 'ascending' : 'descending' : 'none'} className="px-4 py-3"><button onClick={() => changeSort(key)} className="font-semibold">{label}{sort.key === key ? sort.ascending ? ' ↑' : ' ↓' : ' ↕'}</button></th>)}</tr></thead><tbody>
          {enterprises.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Chưa có tài khoản doanh nghiệp.</td></tr> : enterprises.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="px-4 py-3"><div className="font-medium">{row.companyName || 'Chưa có tên công ty'}</div><div className="text-xs text-slate-500">{row.fullName}</div></td><td className="px-4 py-3">{number(row.jobCount)}</td><td className="px-4 py-3">{number(row.candidateCount)}</td><td className="px-4 py-3">{number(row.matchCount)}</td><td className="px-4 py-3">{number(row.inputTokens + row.outputTokens)}</td><td className="px-4 py-3">{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa đăng nhập'}</td></tr>)}
        </tbody></table></div>
      </section>
    </>}
  </div>;
}
