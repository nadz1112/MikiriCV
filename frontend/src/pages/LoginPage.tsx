import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, FileCheck, LoaderCircle, Server } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import {
  getApiBaseUrl,
  isNativeMobile,
  normalizeApiBaseUrl,
  resetApiBaseUrl,
  setApiBaseUrl,
} from '../shared/platform/runtime';

const schema = z.object({ email: z.string().email('Vui lòng nhập email hợp lệ'), password: z.string().min(1, 'Vui lòng nhập mật khẩu') });
type FormValues = z.infer<typeof schema>;
export function LoginPage() {
  const { user, status, login } = useAuthStore(); const location = useLocation(); const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement | null>(null); const [showPassword, setShowPassword] = useState(false); const [serverError, setServerError] = useState('');
  const nativeMobile = isNativeMobile();
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [currentApiUrl, setCurrentApiUrl] = useState(() => getApiBaseUrl());
  const [serverUrlInput, setServerUrlInput] = useState(() => getApiBaseUrl());
  const [checkingServer, setCheckingServer] = useState(false);
  const [serverConfigFeedback, setServerConfigFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  useEffect(() => { emailRef.current?.focus(); }, []);
  const defaultPath = user?.mustChangePassword ? '/change-password' : user?.role === 'ADMIN' ? '/admin/dashboard' : '/';
  if (status === 'loading') return <div className="grid min-h-screen place-items-center text-slate-500">Đang kiểm tra phiên đăng nhập…</div>;
  if (user) return <Navigate to={defaultPath} replace />;
  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError('');
    try {
      const authenticatedUser = await login(email, password);
      navigate(authenticatedUser.mustChangePassword ? '/change-password' : (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || (authenticatedUser.role === 'ADMIN' ? '/admin/dashboard' : '/'), { replace: true });
    } catch (error) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setServerError(err.response?.data?.error?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.');
    }
  });
  const handleSaveServerUrl = () => {
    try {
      const saved = setApiBaseUrl(serverUrlInput);
      setCurrentApiUrl(saved);
      setServerUrlInput(saved);
      setServerConfigFeedback({ ok: true, text: `Đã lưu địa chỉ máy chủ: ${saved}` });
    } catch (error) {
      setServerConfigFeedback({
        ok: false,
        text: error instanceof Error ? error.message : 'Địa chỉ máy chủ không hợp lệ.',
      });
    }
  };

  const handleTestServerUrl = async () => {
    const normalized = normalizeApiBaseUrl(serverUrlInput);
    if (!normalized) {
      setServerConfigFeedback({
        ok: false,
        text: 'Địa chỉ máy chủ không hợp lệ. Ví dụ: http://192.168.1.10:4000/api',
      });
      return;
    }
    setCheckingServer(true);
    setServerConfigFeedback(null);
    try {
      const response = await fetch(`${normalized}/health`, {
        headers: { 'X-Requested-With': 'CVMikiri' },
      });
      if (!response.ok) {
        setServerConfigFeedback({
          ok: false,
          text: `Máy chủ phản hồi mã lỗi HTTP ${response.status}.`,
        });
        return;
      }
      setServerConfigFeedback({
        ok: true,
        text: `Kết nối thành công tới ${normalized}/health`,
      });
    } catch {
      setServerConfigFeedback({
        ok: false,
        text: `Không thể kết nối tới ${normalized}/health. Kiểm tra Wi-Fi, cổng 4000 và CORS.`,
      });
    } finally {
      setCheckingServer(false);
    }
  };

  const handleResetServerUrl = () => {
    resetApiBaseUrl();
    const fallback = getApiBaseUrl();
    setCurrentApiUrl(fallback);
    setServerUrlInput(fallback);
    setServerConfigFeedback({ ok: true, text: `Đã khôi phục mặc định: ${fallback}` });
  };

  return <main className="grid min-h-screen bg-slate-50 md:grid-cols-2">
    <section className="hidden flex-col justify-center bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-800 px-14 text-white md:flex lg:px-24">
      <div className="mb-12 flex items-center gap-3"><span className="rounded-2xl bg-white/15 p-3"><FileCheck size={30} /></span><span className="text-3xl font-bold">CVMikiri</span></div>
      <h1 className="text-4xl font-bold leading-tight">Sàng lọc CV thông minh với AI</h1>
      <ul className="mt-8 space-y-4 text-blue-50"><li>• Quản lý hồ sơ tuyển dụng tập trung</li><li>• Đối chiếu ứng viên với công việc nhanh chóng</li><li>• Tìm ra kỹ năng phù hợp bằng AI</li></ul>
    </section>
    <section className="flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/70 sm:p-10">
        <div className="mb-8 md:hidden"><div className="flex items-center gap-2 text-2xl font-bold text-blue-700"><FileCheck /> CVMikiri</div><p className="mt-2 text-sm text-slate-500">Sàng lọc CV thông minh với AI</p></div>
        <h2 className="text-2xl font-bold text-slate-900">Đăng nhập</h2><p className="mt-2 text-sm text-slate-500">Đăng nhập để tiếp tục sử dụng hệ thống.</p>
        <form noValidate onSubmit={onSubmit} className="mt-7 space-y-5">
          {(location.state as { notice?: string } | null)?.notice && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{(location.state as { notice?: string }).notice}</div>}
          {serverError && <div role="alert" aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{serverError}</div>}
          <div><label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label><input id="email" type="email" autoComplete="username" {...register('email')} ref={(element) => { register('email').ref(element); emailRef.current = element; }} className="w-full rounded-lg border border-slate-300 px-3.5 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />{errors.email && <p className="mt-1 text-sm text-red-700">{errors.email.message}</p>}</div>
          <div><label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Mật khẩu</label><div className="relative"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" {...register('password')} className="w-full rounded-lg border border-slate-300 px-3.5 py-3 pr-12 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 text-slate-500">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>{errors.password && <p className="mt-1 text-sm text-red-700">{errors.password.message}</p>}</div>
          <button disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting && <LoaderCircle className="animate-spin" size={18} />}{isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Chưa có tài khoản? Vui lòng liên hệ quản trị viên.</p>
        {nativeMobile && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setShowServerConfig((prev) => !prev)}
              className="flex w-full items-center justify-between text-left text-xs font-medium text-slate-600 hover:text-blue-700"
            >
              <span className="flex items-center gap-1.5">
                <Server size={14} /> Cấu hình máy chủ API
              </span>
              <span>{showServerConfig ? 'Thu gọn' : 'Mở rộng'}</span>
            </button>
            <p className="mt-1 truncate text-xs text-slate-400">Hiện tại: {currentApiUrl}</p>
            {showServerConfig && (
              <div className="mt-3 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label htmlFor="api-server-url" className="block text-xs font-medium text-slate-700">
                  Địa chỉ Backend API (LAN / Tunnel / Emulator)
                </label>
                <input
                  id="api-server-url"
                  type="url"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://192.168.1.10:4000/api"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={checkingServer}
                    onClick={handleTestServerUrl}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {checkingServer ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveServerUrl}
                    className="rounded-lg bg-blue-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
                  >
                    Lưu máy chủ
                  </button>
                  <button
                    type="button"
                    onClick={handleResetServerUrl}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Mặc định
                  </button>
                </div>
                {serverConfigFeedback && (
                  <p
                    role="status"
                    className={`text-xs ${serverConfigFeedback.ok ? 'text-emerald-700' : 'text-red-700'}`}
                  >
                    {serverConfigFeedback.text}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  </main>;
}
