// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Link } from 'react-router-dom';
import { App } from './App';

const state = vi.hoisted(() => ({
  user: { id: 'hr', role: 'ENTERPRISE', mustChangePassword: false },
  status: 'authenticated', fetchMe: vi.fn(), setUnauthenticated: vi.fn(),
}));
vi.mock('./features/auth/authStore', () => ({ useAuthStore: () => state }));
vi.mock('./components/common/Navbar', () => ({ Navbar: () => null }));
vi.mock('./pages/JobsPage', () => ({ JobsPage: () => <Link to="/candidates">Mở danh sách CV</Link> }));
vi.mock('./pages/CandidatesPage', () => ({ CandidatesPage: () => <div>Danh sách CV kiểm tra</div> }));
vi.mock('./pages/LoginPage', () => ({ LoginPage: () => <div>Trang đăng nhập kiểm tra</div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, '', '/'); });
describe('khôi phục phiên và điều hướng', () => {
  it('không kiểm tra lại phiên khi chuyển trang hoặc nhận sự kiện hết phiên', async () => {
    window.history.replaceState({}, '', '/jobs');
    render(<App/>);
    expect(state.fetchMe).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Mở danh sách CV'));
    expect(await screen.findByText('Danh sách CV kiểm tra')).toBeTruthy();
    expect(state.fetchMe).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event('auth:expired'));
    expect(await screen.findByText('Trang đăng nhập kiểm tra')).toBeTruthy();
    expect(state.fetchMe).toHaveBeenCalledTimes(1);
    expect(state.setUnauthenticated).toHaveBeenCalledTimes(1);
  });
});
