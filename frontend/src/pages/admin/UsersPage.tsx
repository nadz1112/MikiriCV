import { ModalPortal } from '../../components/common/ModalPortal';
import { AccountActions } from '../../components/common/AccountActions';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { useAutoRefresh } from '../../shared/hooks/useAutoRefresh';

const createEnterpriseSchema = z.object({
  email: z.string().trim().email('Vui lòng nhập email hợp lệ'),
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ tên'),
  companyName: z.string().trim().min(1, 'Vui lòng nhập tên công ty'),
  password: z.string().min(8, 'Mật khẩu tạm cần ít nhất 8 ký tự')
    .regex(/[A-Za-z]/, 'Mật khẩu tạm phải có ít nhất một chữ cái (A–Z)')
    .regex(/\d/, 'Mật khẩu tạm phải có ít nhất một chữ số'),
});
type CreateEnterpriseForm = z.infer<typeof createEnterpriseSchema>;
type CreateFieldErrors = Partial<Record<keyof CreateEnterpriseForm, string>>;

interface Enterprise { id: string; email: string; fullName: string; companyName: string | null; isActive: boolean; lastLoginAt: string | null; jobCount: number; candidateCount: number }
const generatePassword = () => { const bytes = crypto.getRandomValues(new Uint8Array(12)); const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; return `A${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}7`; };
export function UsersPage() {
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [companyError, setCompanyError] = useState('');
  const [users, setUsers] = useState<Enterprise[]>([]); const [search, setSearch] = useState(''); const [active, setActive] = useState(''); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false); const [tempPassword, setTempPassword] = useState(''); const [form, setForm] = useState({ email: '', fullName: '', companyName: '', password: '' });
  const [createErrors, setCreateErrors] = useState<CreateFieldErrors>({});
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [resetTarget, setResetTarget] = useState<Enterprise | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [editTarget, setEditTarget] = useState<Enterprise | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', companyName: '' });
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const listRequest = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    void api.get('/users/companies', { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) { setCompanies(data.data); setCompanyError(''); }
    }).catch(() => { if (!controller.signal.aborted) setCompanyError('Không thể tải danh sách doanh nghiệp hiện có.'); });
    return () => controller.abort();
  }, [showCreate, editTarget]);
  const [confirmDelete, setConfirmDelete] = useState<{ user: Enterprise; jobCount: number; candidateCount: number } | null>(null);
  const load = useCallback(async (background = false, signal?: AbortSignal) => {
    const request = ++listRequest.current;
    if (!background) { setLoading(true); setError(''); }
    try {
      const { data } = await api.get('/users', { params: { search, isActive: active || undefined, page, limit: 10 }, signal });
      if (!signal?.aborted && request === listRequest.current) { setUsers(data.data); setTotal(data.total); setError(''); }
    } catch {
      if (!signal?.aborted && request === listRequest.current) setError('Không thể tải danh sách tài khoản.');
    } finally { if (!signal?.aborted && request === listRequest.current) setLoading(false); }
  }, [search, active, page]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(false, controller.signal), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);
  useAutoRefresh((signal) => load(true, signal), !loading);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCreating) return;
    setCreateError(''); setCreateErrors({});
    const parsed = createEnterpriseSchema.safeParse(form);
    if (!parsed.success) {
      const errors: CreateFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && field in form) errors[field as keyof CreateEnterpriseForm] ??= issue.message;
      }
      setCreateErrors(errors);
      setCreateError('Vui lòng kiểm tra các trường bên dưới.');
      return;
    }
    setIsCreating(true);
    try {
      await api.post('/users', parsed.data);
      setTempPassword(parsed.data.password); setForm({ email: '', fullName: '', companyName: '', password: '' }); setShowCreate(false); setShowCreatePassword(false);
      await load();
    } catch (cause) {
      const response = (cause as { response?: { data?: { error?: { message?: string; details?: Array<{ field: string; message: string }> } } } }).response?.data?.error;
      const errors: CreateFieldErrors = {};
      for (const detail of response?.details ?? []) {
        if (detail.field in form) errors[detail.field as keyof CreateEnterpriseForm] ??= detail.message;
      }
      setCreateErrors(errors);
      setCreateError(response?.message || 'Không thể tạo tài khoản. Vui lòng thử lại.');
    } finally { setIsCreating(false); }
  };
  const generate = () => { setForm({ ...form, password: generatePassword() }); setShowCreatePassword(true); setCreateErrors((current) => ({ ...current, password: undefined })); setCreateError(''); };
  const toggle = async (user: Enterprise) => { await api.patch(`/users/${user.id}/status`, { isActive: !user.isActive }); await load(); };
  const edit = (user: Enterprise) => { setEditTarget(user); setEditForm({ fullName: user.fullName, companyName: user.companyName || '' }); setEditError(''); };
  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editTarget || isEditing) return;
    const parsed = createEnterpriseSchema.pick({ fullName: true, companyName: true }).safeParse(editForm);
    if (!parsed.success) { setEditError(parsed.error.issues[0].message); return; }
    setIsEditing(true); setEditError('');
    try {
      await api.put(`/users/${editTarget.id}`, parsed.data);
      setEditTarget(null); await load(true);
    } catch (cause) {
      setEditError((cause as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Không thể cập nhật tài khoản. Vui lòng thử lại.');
    } finally { setIsEditing(false); }
  };
  const reset = (user: Enterprise) => { setResetTarget(user); setResetPassword(''); setShowResetPassword(false); setResetError(''); };
  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetTarget || isResetting) return;
    const parsed = createEnterpriseSchema.shape.password.safeParse(resetPassword);
    if (!parsed.success) { setResetError(parsed.error.issues[0].message); return; }
    setIsResetting(true); setResetError('');
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, { password: parsed.data });
      setTempPassword(parsed.data); setResetTarget(null); setResetPassword('');
    } catch (cause) {
      const response = (cause as { response?: { data?: { error?: { message?: string; details?: Array<{ field: string; message: string }> } } } }).response?.data?.error;
      setResetError(response?.details?.find((detail) => detail.field === 'password')?.message || response?.message || 'Không thể đặt lại mật khẩu. Vui lòng thử lại.');
    } finally { setIsResetting(false); }
  };
  const remove = async (user: Enterprise) => { try { const { data } = await api.get(`/users/${user.id}`); setConfirmDelete({ user, jobCount: data.data.jobCount, candidateCount: data.data.candidateCount }); } catch { setError('Không thể tải thông tin xóa tài khoản.'); } };
  const confirmRemove = async () => { if (!confirmDelete) return; try { await api.delete(`/users/${confirmDelete.user.id}`); setConfirmDelete(null); await load(); } catch { setError('Không thể xóa tài khoản.'); } };
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Quản lý tài khoản doanh nghiệp</h1><p className="mt-1 text-sm text-slate-500">Tạo và quản lý quyền truy cập của các doanh nghiệp.</p></div><button onClick={() => setShowCreate(true)} className="rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white">Tạo tài khoản</button></div>
    <datalist id="company-options">{companies.map((company) => <option key={company.id} value={company.name} />)}</datalist>
    <p className="text-sm text-slate-500">Mỗi doanh nghiệp có thể có nhiều tài khoản HR. Khi tạo hoặc sửa HR, chọn tên doanh nghiệp hiện có hoặc nhập tên doanh nghiệp mới.</p>
    {companyError && <p role="alert" className="text-sm text-red-700">{companyError}</p>}
    {tempPassword && <div role="status" className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><span>Mật khẩu tạm (chỉ hiển thị lần này): <strong>{tempPassword}</strong></span><button onClick={() => void navigator.clipboard.writeText(tempPassword)} className="font-semibold text-blue-700">Sao chép</button><button onClick={() => setTempPassword('')} aria-label="Đóng">×</button></div>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Tìm tên, email hoặc công ty" className="min-w-64 rounded-lg border border-slate-300 px-3 py-2"/><select value={active} onChange={(e) => setActive(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2"><option value="">Tất cả trạng thái</option><option value="true">Hoạt động</option><option value="false">Đã khóa</option></select></div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['Công ty', 'Họ tên', 'Email', 'Trạng thái', 'Đăng nhập cuối', 'JD', 'CV', 'Thao tác'].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">Đang tải…</td></tr> : users.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-500">Chưa có tài khoản doanh nghiệp.</td></tr> : users.map((u) => <tr key={u.id} className="border-t border-slate-100"><td className="px-4 py-3">{u.companyName}</td><td className="px-4 py-3">{u.fullName}</td><td className="px-4 py-3">{u.email}</td><td className="px-4 py-3">{u.isActive ? 'Hoạt động' : 'Đã khóa'}</td><td className="px-4 py-3">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('vi-VN') : '—'}</td><td className="px-4 py-3">{u.jobCount}</td><td className="px-4 py-3">{u.candidateCount}</td><td className="px-4 py-3"><AccountActions name={u.fullName} active={u.isActive} onEdit={() => edit(u)} onToggle={() => void toggle(u)} onReset={() => reset(u)} onDelete={() => void remove(u)} /></td></tr>)}</tbody></table></div>
    <div className="flex items-center justify-between text-sm"><span>{total} tài khoản</span><div className="space-x-2"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Trước</button><span>{page}</span><button disabled={page * 10 >= total} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Sau</button></div></div>
    {showCreate && <ModalPortal><div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/40 p-4">
      <form noValidate onSubmit={create} role="dialog" aria-modal="true" aria-labelledby="create-enterprise-title" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex justify-between"><h2 id="create-enterprise-title" className="text-xl font-bold">Tạo tài khoản doanh nghiệp</h2><button type="button" disabled={isCreating} aria-label="Đóng" onClick={() => { setShowCreate(false); setCreateErrors({}); setCreateError(''); setShowCreatePassword(false); }}>×</button></div>
        {createError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{createError}</p>}
        {([['email','Email'],['fullName','Họ tên'],['companyName','Tên công ty'],['password','Mật khẩu tạm']] as const).map(([key,label]) => <div key={key}>
          <label htmlFor={`create-${key}`} className="block text-sm font-medium">{label}</label>
          <div className="relative">
            <input id={`create-${key}`} list={key === 'companyName' ? 'company-options' : undefined} required disabled={isCreating} value={form[key]} onChange={(event) => { setForm({ ...form, [key]: event.target.value }); setCreateErrors((current) => ({ ...current, [key]: undefined })); }} type={key === 'password' ? showCreatePassword ? 'text' : 'password' : key === 'email' ? 'email' : 'text'} autoComplete={key === 'password' ? 'new-password' : undefined} aria-invalid={Boolean(createErrors[key])} aria-describedby={[key === 'password' ? 'create-password-help' : '', createErrors[key] ? `create-${key}-error` : ''].filter(Boolean).join(' ') || undefined} className={`mt-1 w-full rounded-lg border px-3 py-2 ${key === 'password' ? 'pr-12' : ''}`} />
            {key === 'password' && <button type="button" disabled={isCreating} onClick={() => setShowCreatePassword((current) => !current)} aria-label={showCreatePassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showCreatePassword} className="absolute inset-y-0 right-3 mt-1 text-slate-500">{showCreatePassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
          </div>
          {key === 'password' && <p id="create-password-help" className="mt-1 text-xs text-slate-500">Ít nhất 8 ký tự, gồm chữ cái (A–Z) và chữ số. Tài khoản sẽ phải đổi mật khẩu khi đăng nhập lần đầu.</p>}
          {createErrors[key] && <p id={`create-${key}-error`} className="mt-1 text-sm text-red-700">{createErrors[key]}</p>}
        </div>)}
        <button type="button" disabled={isCreating} onClick={generate} className="text-sm font-semibold text-blue-700">Sinh mật khẩu ngẫu nhiên</button>
        <div className="flex justify-end gap-2"><button disabled={isCreating} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{isCreating ? 'Đang tạo…' : 'Tạo tài khoản'}</button></div>
      </form>
    </div></ModalPortal>}
    {editTarget && <ModalPortal><div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
      <form noValidate onSubmit={submitEdit} role="dialog" aria-modal="true" aria-labelledby="edit-enterprise-title" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4"><h2 id="edit-enterprise-title" className="text-xl font-bold">Sửa tài khoản doanh nghiệp</h2><button type="button" disabled={isEditing} onClick={() => setEditTarget(null)} aria-label="Đóng">×</button></div>
        <p className="text-sm text-slate-500">Email: {editTarget.email}</p>
        {editError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</p>}
        <div><label htmlFor="edit-fullName" className="block text-sm font-medium">Họ tên</label><input id="edit-fullName" required disabled={isEditing} value={editForm.fullName} onChange={(event) => { setEditForm({ ...editForm, fullName: event.target.value }); setEditError(''); }} className="mt-1 w-full rounded-lg border px-3 py-2" /></div>
        <div><label htmlFor="edit-companyName" className="block text-sm font-medium">Tên công ty</label><input id="edit-companyName" list="company-options" required disabled={isEditing} value={editForm.companyName} onChange={(event) => { setEditForm({ ...editForm, companyName: event.target.value }); setEditError(''); }} className="mt-1 w-full rounded-lg border px-3 py-2" /><p className="mt-1 text-sm text-slate-500">Chọn doanh nghiệp hiện có để gán HR. Lịch sử token vẫn được giữ tại doanh nghiệp phát sinh.</p></div>
        <div className="flex justify-end"><button disabled={isEditing} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{isEditing ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </form>
    </div></ModalPortal>}
    {resetTarget && <ModalPortal><div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4">
      <form noValidate onSubmit={submitReset} role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4"><h2 id="reset-password-title" className="text-xl font-bold">Đặt mật khẩu mới</h2><button type="button" disabled={isResetting} onClick={() => { setResetTarget(null); setResetPassword(''); setResetError(''); }} aria-label="Đóng">×</button></div>
        <p className="text-sm text-slate-600">Tài khoản: <strong>{resetTarget.email}</strong></p>
        <p className="text-sm text-slate-500">Không thể xem lại mật khẩu hiện tại. Bạn có thể nhập hoặc sinh mật khẩu mới rồi chỉnh sửa trước khi lưu.</p>
        <div><label htmlFor="reset-password" className="block text-sm font-medium">Mật khẩu mới</label>
          <div className="relative"><input id="reset-password" required disabled={isResetting} autoComplete="new-password" type={showResetPassword ? 'text' : 'password'} value={resetPassword} onChange={(event) => { setResetPassword(event.target.value); setResetError(''); }} aria-invalid={Boolean(resetError)} aria-describedby="reset-password-help" className="mt-1 w-full rounded-lg border py-2 pl-3 pr-12" />
            <button type="button" disabled={isResetting} onClick={() => setShowResetPassword((current) => !current)} aria-label={showResetPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showResetPassword} className="absolute inset-y-0 right-3 mt-1 text-slate-500">{showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <p id="reset-password-help" className="mt-1 text-xs text-slate-500">Ít nhất 8 ký tự, gồm chữ cái (A–Z) và chữ số.</p>
        </div>
        {resetError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{resetError}</p>}
        <button type="button" disabled={isResetting} onClick={() => { setResetPassword(generatePassword()); setShowResetPassword(true); setResetError(''); }} className="text-sm font-semibold text-blue-700">Sinh mật khẩu ngẫu nhiên</button>
        <p className="text-sm text-amber-800">Sau khi lưu, các phiên đăng nhập hiện tại sẽ hết hiệu lực. Người dùng phải đổi mật khẩu khi đăng nhập lại.</p>
        <div className="flex justify-end"><button disabled={isResetting} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{isResetting ? 'Đang lưu…' : 'Lưu mật khẩu mới'}</button></div>
      </form>
    </div></ModalPortal>}
    {confirmDelete && <ConfirmDialog title="Xóa tài khoản doanh nghiệp?" description={`Tài khoản ${confirmDelete.user.companyName || confirmDelete.user.email} cùng ${confirmDelete.jobCount} JD và ${confirmDelete.candidateCount} CV sẽ bị xóa vĩnh viễn.`} confirmText="Xóa tài khoản" onCancel={() => setConfirmDelete(null)} onConfirm={() => void confirmRemove()} />}
  </div>;
}
