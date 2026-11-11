import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore, type AuthUser } from './authStore';

const mocks = vi.hoisted(() => ({ me: vi.fn() }));
vi.mock('./authApi', () => ({ authApi: { me: mocks.me } }));
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, status: 'loading' });
});
describe('khôi phục phiên đăng nhập', () => {
  it('gộp các lần kiểm tra đồng thời, kể cả hiệu ứng StrictMode', async () => {
    let finish: (user: AuthUser) => void = () => {};
    mocks.me.mockReturnValue(new Promise<AuthUser>((resolve) => { finish = resolve; }));
    const first = useAuthStore.getState().fetchMe();
    const second = useAuthStore.getState().fetchMe();
    expect(first).toBe(second);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    finish({ id: 'hr', email: 'sample@example.test', fullName: 'Nhân sự mẫu', companyName: null, role: 'ENTERPRISE', isActive: true, mustChangePassword: false, lastLoginAt: null });
    await first;
    expect(useAuthStore.getState().status).toBe('authenticated');
  });
  it('kết thúc khôi phục khi không có phiên và cho phép kiểm tra lại sau đó', async () => {
    mocks.me.mockRejectedValue(new Error('unauthenticated'));
    await Promise.all([useAuthStore.getState().fetchMe(), useAuthStore.getState().fetchMe()]);
    expect(mocks.me).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    await useAuthStore.getState().fetchMe();
    expect(mocks.me).toHaveBeenCalledTimes(2);
  });
});
