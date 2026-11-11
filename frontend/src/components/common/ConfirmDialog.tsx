import { X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

interface ConfirmDialogProps { title: string; description: string; confirmText: string; onConfirm: () => void; onCancel: () => void }
export function ConfirmDialog({ title, description, confirmText, onConfirm, onCancel }: ConfirmDialogProps) {
  return <ModalPortal>
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-4" role="presentation">
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="confirm-title" className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onCancel} aria-label="Đóng" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <p id="confirm-description" className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-2"><button onClick={onConfirm} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">{confirmText}</button></div>
      </section>
    </div>
  </ModalPortal>;
}
