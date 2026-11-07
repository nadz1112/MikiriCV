import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Navbar } from './components/common/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { CandidatesPage } from './pages/CandidatesPage';
import { MatchingPage } from './pages/MatchingPage';
import { LoginPage } from './pages/LoginPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { UsersPage } from './pages/admin/UsersPage';
import { useAuthStore } from './features/auth/authStore';

export function ProtectedRoute({ roles }: { roles?: Array<'ADMIN' | 'ENTERPRISE'> }) {
  const { user, status } = useAuthStore(); const location = useLocation();
  if (status === 'loading') return <div className="grid min-h-screen place-items-center text-slate-500">Đang tải phiên đăng nhập…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <main className="mx-auto mt-20 max-w-lg rounded-xl bg-white p-8 text-center shadow"><h1 className="text-2xl font-bold">Bạn không có quyền truy cập</h1><p className="mt-2 text-slate-600">Tài khoản hiện tại không thể mở trang này.</p><a className="mt-5 inline-block rounded-lg bg-blue-700 px-4 py-2 text-white" href={user.role === 'ADMIN' ? '/admin/users' : '/'}>Về trang chủ</a></main>;
  return <Outlet/>;
}

function AppRoutes() {
  const { user, fetchMe, setUnauthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    void fetchMe();
    const expired = () => {
      setUnauthenticated();
      navigate('/login', { replace: true, state: { notice: 'Phiên đăng nhập đã hết hạn' } });
    };
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [fetchMe, setUnauthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-['Inter',sans-serif] text-slate-900 w-full">
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
      <main className="flex-1 w-full mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 2xl:px-16 py-6 sm:py-8 max-w-[1920px]">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route
              path="/"
              element={user?.role === 'ADMIN' ? <Navigate to="/admin/users" replace /> : <DashboardPage />}
            />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN', 'ENTERPRISE']} />}>
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ENTERPRISE']} />}>
            <Route path="/matching" element={<MatchingPage />} />
          </Route>
          <Route
            path="*"
            element={<Navigate to={user?.role === 'ADMIN' ? '/admin/users' : user ? '/' : '/login'} replace />}
          />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400 w-full">
        <p>© 2026 CVMikiri — Trợ lý AI Sàng lọc Hồ sơ Tuyển dụng. Powered by Google Gemini & PostgreSQL.</p>
      </footer>
    </div>
  );
}
export const App: React.FC = () => <BrowserRouter><AppRoutes/></BrowserRouter>;
export default App;
