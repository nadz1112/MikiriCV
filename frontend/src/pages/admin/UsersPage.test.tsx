// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UsersPage } from './UsersPage';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../../services/api', () => ({ api: mocks }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue({ data: { data: [], total: 0 } });
  mocks.post.mockResolvedValue({ data: { success: true } });
  mocks.put.mockResolvedValue({ data: { success: true } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openForm(password?: string) {
  const user = userEvent.setup();
  render(<UsersPage />);
  await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
  const dialog = screen.getByRole('dialog', { name: 'Tạo tài khoản doanh nghiệp' });
  await user.type(within(dialog).getByLabelText('Email'), 'new@example.test');
  await user.type(within(dialog).getByLabelText('Họ tên'), 'Người dùng mẫu');
  await user.type(within(dialog).getByLabelText('Tên công ty'), 'Công ty mẫu');
  if (password) await user.type(within(dialog).getByLabelText('Mật khẩu tạm'), password);
  return { user, dialog };
}

it.each([
  ['1345679', 'Mật khẩu tạm cần ít nhất 8 ký tự'],
  ['13456789', 'Mật khẩu tạm phải có ít nhất một chữ cái (A–Z)'],
  ['abcdefgh', 'Mật khẩu tạm phải có ít nhất một chữ số'],
])('explains the invalid password before sending a request: %s', async (password, message) => {
  const { user, dialog } = await openForm(password);
  await user.click(within(dialog).getByRole('button', { name: 'Tạo tài khoản' }));
  expect(within(dialog).getByText(message)).toBeTruthy();
  expect(within(dialog).getByLabelText('Mật khẩu tạm').getAttribute('aria-invalid')).toBe('true');
  expect(mocks.post).not.toHaveBeenCalled();
});

it('creates with a valid password and keeps the one-time temporary-password display', async () => {
  const { user, dialog } = await openForm('Temporary123');
  await user.click(within(dialog).getByRole('button', { name: 'Tạo tài khoản' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.post).toHaveBeenCalledWith('/users', expect.objectContaining({ password: 'Temporary123' }));
  expect(screen.getByRole('status').textContent).toContain('Temporary123');
});

it('lets the admin edit a generated password before creating the account', async () => {
  const { user, dialog } = await openForm();
  await user.click(within(dialog).getByRole('button', { name: 'Sinh mật khẩu ngẫu nhiên' }));
  const password = (within(dialog).getByLabelText('Mật khẩu tạm') as HTMLInputElement).value;
  expect(password.length).toBeGreaterThanOrEqual(8);
  expect(password).toMatch(/[A-Za-z]/); expect(password).toMatch(/\d/);
  await user.clear(within(dialog).getByLabelText('Mật khẩu tạm'));
  await user.type(within(dialog).getByLabelText('Mật khẩu tạm'), 'Edited12345');
  await user.click(within(dialog).getByRole('button', { name: 'Tạo tài khoản' }));
  expect(mocks.post).toHaveBeenCalledWith('/users', expect.objectContaining({ password: 'Edited12345' }));
});

it('shows and hides the temporary password without changing its editable value', async () => {
  const { user, dialog } = await openForm('Temporary123');
  const input = within(dialog).getByLabelText('Mật khẩu tạm') as HTMLInputElement;
  expect(input.type).toBe('password');
  await user.click(within(dialog).getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(input.type).toBe('text'); expect(input.value).toBe('Temporary123');
  await user.clear(input); await user.type(input, 'Changed12345');
  await user.click(within(dialog).getByRole('button', { name: 'Ẩn mật khẩu' }));
  expect(input.type).toBe('password'); expect(input.value).toBe('Changed12345');
});

it('shows server validation details inside the open form instead of behind it', async () => {
  mocks.post.mockRejectedValue({ response: { data: { error: { message: 'Dữ liệu đầu vào không hợp lệ', details: [{ field: 'password', message: 'Mật khẩu không được chấp nhận' }] } } } });
  const { user, dialog } = await openForm('Temporary123');
  await user.click(within(dialog).getByRole('button', { name: 'Tạo tài khoản' }));
  expect(await within(dialog).findByText('Mật khẩu không được chấp nhận')).toBeTruthy();
  expect(within(dialog).getByRole('alert').textContent).toContain('Dữ liệu đầu vào không hợp lệ');
});

async function openAccountDialog(action = 'Đặt lại MK', title = 'Đặt mật khẩu mới') {
  mocks.get.mockResolvedValue({ data: { data: [{ id: 'hr', email: 'hr@example.test', fullName: 'Nhân sự mẫu', companyName: 'Công ty mẫu', isActive: true, lastLoginAt: null, jobCount: 0, candidateCount: 0 }], total: 1 } });
  const user = userEvent.setup();
  render(<UsersPage />);
  await user.click(await screen.findByRole('button', { name: action }));
  return { user, dialog: screen.getByRole('dialog', { name: title }) };
}
const openResetForm = () => openAccountDialog();

it('lets the admin view, edit and confirm a new password for an existing account', async () => {
  const { user, dialog } = await openResetForm();
  expect(mocks.post).not.toHaveBeenCalled();
  expect(within(dialog).getByText(/Không thể xem lại mật khẩu hiện tại/)).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Sinh mật khẩu ngẫu nhiên' }));
  const input = within(dialog).getByLabelText('Mật khẩu mới') as HTMLInputElement;
  expect(input.type).toBe('text');
  await user.clear(input); await user.type(input, 'ResetEdited123');
  await user.click(within(dialog).getByRole('button', { name: 'Ẩn mật khẩu' }));
  expect(input.type).toBe('password'); expect(input.value).toBe('ResetEdited123');
  await user.click(within(dialog).getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(input.type).toBe('text');
  expect(mocks.post).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'Lưu mật khẩu mới' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/users/hr/reset-password', { password: 'ResetEdited123' });
  expect(screen.getByRole('status').textContent).toContain('ResetEdited123');
});

it('does not reset an account when closing the form or submitting an invalid password', async () => {
  const { user, dialog } = await openResetForm();
  await user.type(within(dialog).getByLabelText('Mật khẩu mới'), '123');
  await user.click(within(dialog).getByRole('button', { name: 'Lưu mật khẩu mới' }));
  expect(within(dialog).getByRole('alert').textContent).toContain('ít nhất 8 ký tự');
  expect(mocks.post).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'Đóng' }));
  expect(screen.queryByRole('dialog')).toBeNull(); expect(mocks.post).not.toHaveBeenCalled();
});

it('keeps reset errors inside the form so the admin can correct and retry', async () => {
  mocks.post.mockRejectedValueOnce({ response: { data: { error: { message: 'Không thể đặt lại mật khẩu' } } } });
  const { user, dialog } = await openResetForm();
  await user.type(within(dialog).getByLabelText('Mật khẩu mới'), 'ValidReset123');
  await user.click(within(dialog).getByRole('button', { name: 'Lưu mật khẩu mới' }));
  expect(await within(dialog).findByRole('alert')).toBeTruthy();
  await user.clear(within(dialog).getByLabelText('Mật khẩu mới'));
  await user.type(within(dialog).getByLabelText('Mật khẩu mới'), 'AnotherReset123');
  await user.click(within(dialog).getByRole('button', { name: 'Lưu mật khẩu mới' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.post).toHaveBeenLastCalledWith('/users/hr/reset-password', { password: 'AnotherReset123' });
});

it('edits an account in a prefilled app dialog with no native prompt', async () => {
  const prompt = vi.spyOn(window, 'prompt');
  const { user, dialog } = await openAccountDialog('Sửa', 'Sửa tài khoản doanh nghiệp');
  const name = within(dialog).getByLabelText('Họ tên') as HTMLInputElement;
  expect(name.value).toBe('Nhân sự mẫu');
  expect((within(dialog).getByLabelText('Tên công ty') as HTMLInputElement).value).toBe('Công ty mẫu');
  await user.click(dialog.parentElement!); await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toBeTruthy();
  await user.clear(name); await user.type(name, 'Tên đã sửa');
  await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(mocks.put).toHaveBeenCalledWith('/users/hr', { fullName: 'Tên đã sửa', companyName: 'Công ty mẫu' });
  expect(prompt).not.toHaveBeenCalled();
});

it('keeps edit validation and server errors inside the dialog', async () => {
  const { user, dialog } = await openAccountDialog('Sửa', 'Sửa tài khoản doanh nghiệp');
  const name = within(dialog).getByLabelText('Họ tên');
  await user.clear(name);
  await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
  expect(within(dialog).getByRole('alert').textContent).toContain('Vui lòng nhập họ tên');
  expect(mocks.put).not.toHaveBeenCalled();
  mocks.put.mockRejectedValueOnce(new Error('offline'));
  await user.type(name, 'Tên mới');
  await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
  expect((await within(dialog).findByRole('alert')).textContent).toContain('Không thể cập nhật tài khoản');
});

it('refreshes HR activity on focus without overwriting the open edit draft', async () => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const { user, dialog } = await openAccountDialog('Sửa', 'Sửa tài khoản doanh nghiệp');
  const name = within(dialog).getByLabelText('Họ tên') as HTMLInputElement;
  await user.clear(name); await user.type(name, 'Bản nháp chưa lưu');
  mocks.get.mockResolvedValue({ data: { data: [{ id: 'hr', email: 'hr@example.test', fullName: 'HR vừa thay đổi', companyName: 'Công ty mới', isActive: true, lastLoginAt: null, jobCount: 5, candidateCount: 3 }], total: 1 } });
  fireEvent(window, new Event('focus'));
  expect(await screen.findByRole('cell', { name: 'HR vừa thay đổi' })).toBeTruthy();
  expect(screen.getByRole('cell', { name: '5' })).toBeTruthy();
  expect(name.value).toBe('Bản nháp chưa lưu');
  expect(mocks.put).not.toHaveBeenCalled();
});
