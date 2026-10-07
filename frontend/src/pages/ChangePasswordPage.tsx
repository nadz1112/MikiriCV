import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../features/auth/authStore';

export function ChangePasswordPage() {
  const user = useAuthStore((state) => state.user); const navigate = useNavigate(); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  const [currentPassword, setCurrentPassword] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError('Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số.'); return; }
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); return; }
    try { await api.post('/auth/change-password', { currentPassword, newPassword: password }); await useAuthStore.getState().fetchMe(); setDone(true); navigate(user?.role === 'ADMIN' ? '/admin/users' : '/jobs', { replace: true }); }
    catch (err) { const e = err as { response?: { data?: { error?: { message?: string } } } }; setError(e.response?.data?.error?.message || 'Không thể đổi mật khẩu.'); }
  };
  return <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Đổi mật khẩu</h1><p className="mt-2 text-sm text-slate-500">Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số.</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{done && <p className="mt-4 text-green-700">Đã đổi mật khẩu.</p>}
    <form onSubmit={submit} className="mt-6 space-y-4">{[['current', 'Mật khẩu hiện tại', currentPassword, setCurrentPassword], ['new', 'Mật khẩu mới', password, setPassword], ['confirm', 'Xác nhận mật khẩu mới', confirm, setConfirm]].map(([id, label, value, setter]) => <div key={String(id)}><label htmlFor={String(id)} className="mb-1 block text-sm font-medium">{String(label)}</label><input required id={String(id)} type="password" value={String(value)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></div>)}<button className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white">Cập nhật mật khẩu</button></form>
  </div>;
}
