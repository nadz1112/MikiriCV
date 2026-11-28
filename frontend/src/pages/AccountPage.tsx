import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { useSubscriptionStore } from '../features/subscription/subscriptionStore';
import { useAccountDialogsStore } from '../features/subscription/accountDialogsStore';
import { getPersonalUsageHistory, type PersonalUsageHistory } from '../services/subscriptionApi';
import { ChangePasswordPage } from './ChangePasswordPage';
import { useIsMobileViewport } from '../shared/hooks/useIsMobileViewport';
import { offlineDb } from '../shared/offline/offlineDb';
import { isNetworkOfflineError } from '../shared/platform/runtime';
import { useSafeAuth } from '../features/auth/useSafeAuth';

const number = (value: number) => value.toLocaleString('vi-VN');
const date = (value?: string | null, time = false) => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value)) : 'Không giới hạn';
const tabs = [{ key: 'profile', label: 'Hồ sơ' }, { key: 'security', label: 'Bảo mật' }, { key: 'plan', label: 'Gói & token' }];

export function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const [params, setParams] = useSearchParams();
  const tab = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab')! : 'profile';
  return <div className="mx-auto max-w-5xl space-y-5"><h1 className="text-2xl font-bold">Tài khoản của tôi</h1>
    <div role="tablist" aria-label="Thông tin tài khoản" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map((t) => <button key={t.key} id={`account-tab-${t.key}`} role="tab" aria-selected={tab === t.key} aria-controls={`account-panel-${t.key}`} tabIndex={tab === t.key ? 0 : -1} disabled={user?.mustChangePassword && t.key !== 'security'}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || user?.mustChangePassword) return;
          event.preventDefault(); const index = tabs.findIndex((v) => v.key === t.key);
          const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          setParams({ tab: next.key }); document.getElementById(`account-tab-${next.key}`)?.focus();
        }} onClick={() => setParams({ tab: t.key })} className={`min-h-[44px] flex-1 whitespace-nowrap rounded-lg px-3 py-3 text-sm font-semibold disabled:opacity-40 ${tab === t.key ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>{t.label}</button>)}
    </div>
    <section role="tabpanel" id={`account-panel-${tab}`} aria-labelledby={`account-tab-${tab}`} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      {tab === 'profile' && <><h2 className="text-lg font-bold">Hồ sơ cá nhân</h2><dl className="mt-5 grid gap-5 md:grid-cols-2">{[['Họ tên', user?.fullName], ['Email', user?.email], ['Công ty', user?.companyName || 'Chưa có thông tin công ty']].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl><p className="mt-5 text-sm text-slate-500">Liên hệ quản trị viên nếu bạn cần cập nhật thông tin hồ sơ.</p></>}
      {tab === 'security' && <ChangePasswordPage embedded />}
      {tab === 'plan' && <PersonalPlanPanel key={user?.id} />}
    </section>
  </div>;
}

function PersonalPlanPanel() {
  const { user } = useSafeAuth();
  const isMobile = useIsMobileViewport();
  const { subscription, isLoading, error, fetchSubscription } = useSubscriptionStore();
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<PersonalUsageHistory>();
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { void fetchSubscription(true); }, [fetchSubscription]);
  useEffect(() => {
    const controller = new AbortController(); setHistoryLoading(true); setHistoryError(''); setHistory(undefined);
    void getPersonalUsageHistory(page, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setHistory(value);
          if (page === 1 && user?.id) void offlineDb.savePersonalUsage(user.id, value);
        }
      })
      .catch(async (err) => {
        if (controller.signal.aborted) return;
        if (page === 1 && user?.id && isNetworkOfflineError(err)) {
          const cached = await offlineDb.getPersonalUsage(user.id);
          if (cached && !controller.signal.aborted) {
            setHistory(cached.history);
            return;
          }
        }
        if (!controller.signal.aborted) setHistoryError('Không thể tải lịch sử sử dụng của bạn.');
      })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [page, retry, user?.id]);
  if (!subscription && isLoading) return <p role="status">Đang tải gói và token cá nhân…</p>;
  return <div className="space-y-6">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error} <button className="underline" onClick={() => void fetchSubscription(true)}>Thử lại</button></p>}
    {!subscription && !isLoading && !error && <p>Chưa có thông tin gói dịch vụ.</p>}
    {subscription && <>
      <section aria-label="Gói của công ty" className="rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Gói của công ty: {subscription.name}</h2><p className="mt-1 text-sm">Ngày hết hạn: {date(subscription.endsAt)}</p><p className="mt-1 text-sm">Tài khoản doanh nghiệp: Không giới hạn</p><p className="mt-1 text-sm">Phí dịch vụ: {subscription.monthlyPriceVnd != null ? `${number(subscription.monthlyPriceVnd)}đ / doanh nghiệp / tháng` : 'Chưa cấu hình'}</p></div>{subscription.name === 'FREE' && <button onClick={() => useAccountDialogsStore.getState().compare()} className="min-h-[40px] rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Nâng cấp</button>}</div>
        <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">{[['CV mỗi lần chạy', number(subscription.maxCvPerCall)], ['Trang PDF mỗi CV', number(subscription.maxPages)], ['Ký tự mỗi CV', number(subscription.maxCharacters)]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>
      </section>
      <section aria-label="Token cá nhân"><h2 className="text-lg font-bold">Token cá nhân</h2><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">{[['Đã dùng', subscription.used ?? 0], ['Còn lại', subscription.remaining ?? 0], ['Hạn mức', subscription.tokenLimit]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-3"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 break-all text-lg font-bold">{number(Number(value))}</p></div>)}</div>
        <progress aria-label="Token cá nhân đã dùng" value={Math.min(subscription.used ?? 0, subscription.tokenLimit)} max={Math.max(1, subscription.tokenLimit)} className="mt-4 h-3 w-full accent-blue-700" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm"><p>Ngày đặt lại chu kỳ: {date(subscription.periodEnd)}</p><span className="group relative"><button type="button" aria-describedby="held-tokens-help" className="rounded border-b border-dotted border-slate-400 text-slate-600">Đang giữ: {number(subscription.reservedTokens ?? 0)} token ⓘ</button><span id="held-tokens-help" role="tooltip" className="absolute right-0 bottom-full z-10 mb-2 hidden w-64 max-w-[calc(100vw-3rem)] rounded-lg bg-slate-900 p-3 text-xs leading-5 text-white group-hover:block group-focus-within:block">Token được giữ tạm cho các lần chạy đang xử lý hoặc chờ xác nhận. Phần chưa dùng sẽ được trả lại khi hoàn tất. Số còn lại đã trừ phần đang giữ.</span></span></div>
        {history && <p className="mt-3 text-sm text-slate-600">≈ {number(Math.floor((subscription.remaining ?? 0) / Math.max(1, history.estimate.averageTokensPerCv)))} CV có thể xử lý — chỉ là ước tính, {history.estimate.source === 'PERSONAL_HISTORY' ? `dựa trên mức dùng trung bình của ${number(history.estimate.sampleCount)} CV của bạn` : `dùng mức tham khảo ${number(history.estimate.averageTokensPerCv)} token/CV vì bạn chưa có lịch sử đủ dữ liệu`}. Mức dùng thực tế tùy hồ sơ và JD.</p>}
      </section>
    </>}
    <section aria-label="Lịch sử sử dụng của tôi"><h2 className="text-lg font-bold">Lịch sử sử dụng của tôi</h2><p className="mt-1 text-sm text-slate-500">Mỗi dòng là một lần xử lý CV của chính bạn.</p>
      {historyLoading && <p role="status" className="mt-3">Đang tải lịch sử…</p>}
      {historyError && <p role="alert" className="mt-3 text-sm text-red-700">{historyError} <button className="underline" onClick={() => setRetry((v) => v + 1)}>Thử lại</button></p>}
      {!historyLoading && !historyError && history?.entries.length === 0 && <p className="py-6 text-sm text-slate-500">Bạn chưa có lịch sử sử dụng ở trang này.</p>}
      {history && history.entries.length > 0 && (isMobile ? (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {history.entries.map((entry) => (
            <li key={entry.id} className="space-y-1.5 p-3.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-slate-900">{entry.jobTitle ?? 'Chưa có thông tin JD'}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {entry.tokensUsed == null ? 'Chưa xác định' : `${number(entry.tokensUsed)} token`}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{date(entry.createdAt, true)}</span>
                <span>{entry.cvCount} CV</span>
              </div>
              {!entry.succeeded && <p className="text-xs text-amber-700">Chưa hoàn tất thành công</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><caption className="sr-only">Lịch sử xử lý CV cá nhân</caption><thead className="bg-slate-50"><tr>{['Thời gian', 'JD', 'Số CV', 'Token đã dùng'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{history.entries.map((entry) => <tr key={entry.id} className="border-t border-slate-100"><td className="whitespace-nowrap p-3">{date(entry.createdAt, true)}{!entry.succeeded && <span className="block text-xs text-slate-500">Chưa hoàn tất thành công</span>}</td><td className="max-w-xs break-words p-3">{entry.jobTitle ?? 'Chưa có thông tin JD'}</td><td className="p-3">{entry.cvCount}</td><td className="p-3">{entry.tokensUsed == null ? 'Chưa xác định' : number(entry.tokensUsed)}</td></tr>)}</tbody></table></div>
      ))}
      {history && history.total > 0 && <nav aria-label="Phân trang lịch sử" className="mt-4 flex items-center justify-between gap-3 text-sm"><button disabled={page <= 1 || historyLoading} onClick={() => setPage((v) => v - 1)} className="min-h-[40px] rounded-lg border px-3 py-2 disabled:opacity-40">Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(history.total / history.pageSize))}</span><button disabled={page * history.pageSize >= history.total || historyLoading} onClick={() => setPage((v) => v + 1)} className="min-h-[40px] rounded-lg border px-3 py-2 disabled:opacity-40">Sau</button></nav>}
    </section>
  </div>;
}
