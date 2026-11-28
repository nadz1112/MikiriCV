import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Navbar } from './components/common/Navbar';
import { BottomNav } from './components/common/BottomNav';
import { NetworkStatusBanner } from './components/common/NetworkStatusBanner';
import { DashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { CandidatesPage } from './pages/CandidatesPage';
import { MatchingPage } from './pages/MatchingPage';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { UsersPage } from './pages/admin/UsersPage';
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { CompaniesPage } from './pages/admin/CompaniesPage';
import { useAuthStore } from './features/auth/authStore';
import { useSubscriptionStore } from './features/subscription/subscriptionStore';
import { useAutoRefresh } from './shared/hooks/useAutoRefresh';
import { AccountPage } from './pages/AccountPage';
import { AccountDialogs } from './features/subscription/components/AccountDialogs';
import { useAccountDialogsStore } from './features/subscription/accountDialogsStore';
import { initNetworkListeners, useNetworkStore } from './shared/offline/networkStore';
import { processOutboxQueue } from './shared/offline/syncQueue';

export function ProtectedRoute({ roles }: { roles?: Array<'ADMIN' | 'ENTERPRISE'> }) {
  const { user, status } = useAuthStore(); const location = useLocation();
  if (status === 'loading') return <div className="grid min-h-screen place-items-center text-slate-500">Đang tải phiên đăng nhập…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  const isAccountSecurity = user.role === 'ENTERPRISE' && location.pathname === '/account' && new URLSearchParams(location.search).get('tab') === 'security';
  if (user.mustChangePassword && location.pathname !== '/change-password' && !isAccountSecurity) return <Navigate to={user.role === 'ENTERPRISE' ? '/account?tab=security' : '/change-password'} replace />;
  if (roles && !roles.includes(user.role)) return <main className="mx-auto mt-20 max-w-lg rounded-xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-bold">Bạn không có quyền truy cập</h1><p className="mt-2 text-slate-600">Tài khoản hiện tại không thể mở trang này.</p><a className="mt-5 inline-block rounded-lg bg-blue-700 px-4 py-2 text-white" href={user.role === 'ADMIN' ? '/admin/dashboard' : '/'}>Về trang chủ</a></main>;
  return <Outlet/>;
}

function AppRoutes() {
  const { user, isOfflineSession, fetchMe, setUnauthenticated } = useAuthStore();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const navigate = useNavigate();
  useAutoRefresh(() => useSubscriptionStore.getState().refreshBalance(), isOnline && user?.role === 'ENTERPRISE' && !user.mustChangePassword);
  useEffect(() => { useAccountDialogsStore.getState().close(); }, [user?.id]);

  useEffect(() => {
    initNetworkListeners();
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (isOnline && isOfflineSession) {
      void fetchMe();
    }
  }, [isOnline, isOfflineSession, fetchMe]);

  useEffect(() => {
    if (isOnline && user?.id && !user.mustChangePassword && !isOfflineSession) {
      void processOutboxQueue(user.id);
    }
  }, [isOnline, user?.id, user?.mustChangePassword, isOfflineSession]);

  useEffect(() => {
    if (isOnline && user?.role === 'ENTERPRISE' && !user.mustChangePassword) {
      void useSubscriptionStore.getState().fetchSubscription();
    }
  }, [isOnline, user?.id, user?.role, user?.mustChangePassword]);

  useEffect(() => {
    const expired = () => {
      setUnauthenticated();
      navigate('/login', { replace: true, state: { notice: 'Phiên đăng nhập đã hết hạn' } });
    };
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [setUnauthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Inter',system-ui,-apple-system,sans-serif] text-slate-900 w-full">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            fontSize: '13px',
            borderRadius: '12px',
          },
        }}
      />
      <Navbar />
      <NetworkStatusBanner />
      {user?.role === 'ENTERPRISE' && <AccountDialogs />}
      <main className="flex-1 w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16 py-5 sm:py-8 pb-24 md:pb-8 max-w-[1920px]">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={user?.role === 'ENTERPRISE' ? <Navigate to="/account?tab=security" replace /> : <ChangePasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/companies" element={<CompaniesPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={user?.role === 'ADMIN' ? <Navigate to="/admin/dashboard" replace /> : <DashboardPage />}
            />
          </Route>
          <Route element={<ProtectedRoute roles={['ENTERPRISE']} />}>
            <Route path="/account" element={<AccountPage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/matching" element={<MatchingPage />} />
          </Route>
          <Route
            path="*"
            element={<Navigate to={user?.role === 'ADMIN' ? '/admin/dashboard' : user ? '/' : '/login'} replace />}
          />
        </Routes>
      </main>
      <footer className="hidden md:block border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400 w-full">
        <p>© 2026 CVMikiri — Trợ lý AI Sàng lọc Hồ sơ Tuyển dụng. Powered by Google Gemini & PostgreSQL.</p>
      </footer>
      <BottomNav />
    </div>
  );
}
export const App: React.FC = () => <BrowserRouter><AppRoutes/></BrowserRouter>;
export default App;
