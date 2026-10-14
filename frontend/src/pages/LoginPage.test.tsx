// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const mocks = vi.hoisted(() => ({ login: vi.fn(), user: null as null | { id: string; email: string; fullName: string; companyName: string | null; role: 'ADMIN' | 'ENTERPRISE'; isActive: boolean; mustChangePassword: boolean; lastLoginAt: null }, status: 'unauthenticated' as 'loading' | 'authenticated' | 'unauthenticated' }));
vi.mock('../features/auth/authStore', () => ({ useAuthStore: () => ({ user: mocks.user, status: mocks.status, login: mocks.login }) }));

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.user = null; mocks.status = 'unauthenticated'; });
const renderLogin = () => render(<MemoryRouter initialEntries={['/login']}><Routes><Route path="/login" element={<LoginPage/>}/><Route path="/jobs" element={<div>Trang công việc</div>}/><Route path="/admin/users" element={<div>Quản lý tài khoản</div>}/><Route path="/change-password" element={<div>Đổi mật khẩu</div>}/></Routes></MemoryRouter>);

describe('LoginPage', () => {
  it('validates the email field before sending credentials', async () => {
    const user = userEvent.setup(); renderLogin();
    await user.type(screen.getByLabelText('Email'), 'khong-phai-email');
    await user.type(screen.getByLabelText('Mật khẩu'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Vui lòng nhập email hợp lệ')).toBeTruthy();
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('shows server errors and redirects ENTERPRISE to jobs after login', async () => {
    const user = userEvent.setup(); renderLogin();
    mocks.login.mockRejectedValueOnce({ response: { data: { error: { message: 'Email hoặc mật khẩu không đúng' } } } });
    await user.type(screen.getByLabelText('Email'), 'hr@example.com'); await user.type(screen.getByLabelText('Mật khẩu'), 'badpass123');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Email hoặc mật khẩu không đúng');
    mocks.login.mockResolvedValueOnce({ role: 'ENTERPRISE', mustChangePassword: false });
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(screen.getByText('Trang công việc')).toBeTruthy());
  });
});
