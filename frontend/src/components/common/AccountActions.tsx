import { KeyRound, Lock, Pencil, Trash2, Unlock } from 'lucide-react';

interface AccountActionsProps {
  name: string;
  active: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onReset: () => void;
  onDelete: () => void;
}

export function AccountActions({ name, active, onEdit, onToggle, onReset, onDelete }: AccountActionsProps) {
  const button = 'inline-flex h-10 w-10 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';
  return <div role="group" aria-label={`Thao tác tài khoản ${name}`} className="flex items-center gap-2">
    <button type="button" aria-label="Sửa" title={`Sửa tài khoản ${name}`} onClick={onEdit} className={`${button} border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700`}><Pencil size={17} aria-hidden="true" /></button>
    <button type="button" aria-label={active ? 'Khóa' : 'Mở khóa'} title={`${active ? 'Khóa' : 'Mở khóa'} tài khoản ${name}`} onClick={onToggle} className={`${button} ${active ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{active ? <Lock size={17} aria-hidden="true" /> : <Unlock size={17} aria-hidden="true" />}</button>
    <button type="button" aria-label="Đặt lại MK" title={`Đặt lại mật khẩu cho ${name}`} onClick={onReset} className={`${button} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}><KeyRound size={17} aria-hidden="true" /></button>
    <button type="button" aria-label="Xóa" title={`Xóa tài khoản ${name}`} onClick={onDelete} className={`${button} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}><Trash2 size={17} aria-hidden="true" /></button>
  </div>;
}
