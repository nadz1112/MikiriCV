import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../features/auth/authStore';
import { useNetworkStore } from '../shared/offline/networkStore';

export function ChangePasswordPage({ embedded = false }: { embedded?: boolean }) {
  const user = useAuthStore((state) => state.user);
  const isOnline = useNetworkStore((state) => state.isOnline);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return;
    setError(''); setDone(false);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError('Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số.'); return; }
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword: password });
      await useAuthStore.getState().fetchMe(); setDone(true);
      setCurrentPassword(''); setPassword(''); setConfirm('');
      if (!embedded) navigate(user?.role === 'ADMIN' ? '/admin/dashboard' : '/', { replace: true });
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e.response?.data?.error?.message || 'Không thể đổi mật khẩu.');
    } finally { setSaving(false); }
  };
  const fields = [
    { id: 'current', label: 'Mật khẩu hiện tại', value: currentPassword, set: setCurrentPassword, autocomplete: 'current-password' },
    { id: 'new', label: 'Mật khẩu mới', value: password, set: setPassword, autocomplete: 'new-password' },
    { id: 'confirm', label: 'Xác nhận mật khẩu mới', value: confirm, set: setConfirm, autocomplete: 'new-password' },
  ];
  return <div className={embedded ? 'max-w-lg' : 'mx-auto max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-sm'}>
    <h2 className="text-2xl font-bold">Đổi mật khẩu</h2><p className="mt-2 text-sm text-slate-500">Mật khẩu cần ít nhất 8 ký tự, gồm chữ và số.</p>
    {!isOnline && <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Cần kết nối mạng để đổi mật khẩu.</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {done && <p role="status" className="mt-4 text-green-700">Đã đổi mật khẩu thành công.</p>}
    <form onSubmit={submit} className="mt-6 space-y-4">{fields.map((f) => <div key={f.id}><label htmlFor={f.id} className="mb-1 block text-sm font-medium">{f.label}</label><input required id={f.id} type="password" autoComplete={f.autocomplete} value={f.value} onChange={(e) => f.set(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></div>)}<button disabled={saving || !isOnline} className="min-h-[44px] rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}</button></form>
  </div>;
}
