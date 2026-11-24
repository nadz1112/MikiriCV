// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './App';
import { Navbar } from './components/common/Navbar';

const state = vi.hoisted(() => ({
  user: null as null | { role: 'ADMIN' | 'ENTERPRISE'; fullName?: string; companyName?: string | null; mustChangePassword: boolean },
  status: 'unauthenticated' as 'loading' | 'authenticated' | 'unauthenticated',
  logout: vi.fn(),
}));
vi.mock('./features/auth/authStore', () => ({ useAuthStore: () => state }));
afterEach(() => { cleanup(); state.user = null; state.status = 'unauthenticated'; });

describe('ProtectedRoute', () => {
  it('sends unauthenticated users to login', () => {
    render(<MemoryRouter initialEntries={['/admin/users']}><Routes><Route element={<ProtectedRoute roles={['ADMIN']}/>}><Route path="/admin/users" element={<div>Admin</div>}/></Route><Route path="/login" element={<div>Đăng nhập</div>}/></Routes></MemoryRouter>);
    expect(screen.getByText('Đăng nhập')).toBeTruthy();
  });

  it('shows the friendly forbidden page when the role does not match', () => {
    state.user = { role: 'ENTERPRISE', mustChangePassword: false }; state.status = 'authenticated';
    render(<MemoryRouter initialEntries={['/admin/users']}><Routes><Route element={<ProtectedRoute roles={['ADMIN']}/>}><Route path="/admin/users" element={<div>Admin</div>}/></Route></Routes></MemoryRouter>);
    expect(screen.getByText('Bạn không có quyền truy cập')).toBeTruthy();
  });

  it('allows ENTERPRISE to access /jobs and shows Quản lý JD in Navbar, while hiding it from ADMIN', () => {
    state.user = { role: 'ENTERPRISE', fullName: 'HR User', companyName: 'Mikiri', mustChangePassword: false };
    state.status = 'authenticated';
    render(
      <MemoryRouter initialEntries={['/jobs']}>
        <Navbar />
        <Routes>
          <Route element={<ProtectedRoute roles={['ENTERPRISE']} />}>
            <Route path="/jobs" element={<div>Trang Quản lý JD</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Quản lý JD').length).toBeGreaterThan(0);
    expect(screen.getByText('Trang Quản lý JD')).toBeTruthy();
    cleanup();

    state.user = { role: 'ADMIN', fullName: 'Admin User', companyName: null, mustChangePassword: false };
    render(
      <MemoryRouter initialEntries={['/jobs']}>
        <Navbar />
        <Routes>
          <Route element={<ProtectedRoute roles={['ENTERPRISE']} />}>
            <Route path="/jobs" element={<div>Trang Quản lý JD</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Quản lý JD')).toBeNull();
    expect(screen.getByText('Bạn không có quyền truy cập')).toBeTruthy();
  });
});
