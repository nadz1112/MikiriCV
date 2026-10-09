// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './App';

const state = vi.hoisted(() => ({ user: null as null | { role: 'ADMIN' | 'ENTERPRISE'; mustChangePassword: boolean }, status: 'unauthenticated' as 'loading' | 'authenticated' | 'unauthenticated' }));
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
});
