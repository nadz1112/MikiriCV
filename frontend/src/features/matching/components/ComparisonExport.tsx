import { useState } from 'react';
import { api } from '../../../services/api';
export function ComparisonExport({ jobId, candidateIds, plus }: { jobId: string; candidateIds: string[]; plus: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const exportReport = async (format: 'excel' | 'print') => {
    if (busy) return;
    const printWindow = format === 'print' ? window.open('', '_blank') : null;
    if (format === 'print' && !printWindow) { setError('Vui lòng cho phép mở cửa sổ để in / lưu PDF.'); return; }
    if (printWindow) printWindow.opener = null;
    setBusy(true); setError('');
    try {
      const response = await api.post('/matching/export', { jobId, candidateIds, format }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data], { type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/html;charset=utf-8' }));
      if (printWindow) printWindow.location.replace(url);
      else { const link = document.createElement('a'); link.href = url; link.download = 'so-sanh-ung-vien.xlsx'; link.click(); }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { printWindow?.close(); setError('Không thể xuất báo cáo. Vui lòng kiểm tra quyền gói PLUS và thử lại.'); }
    finally { setBusy(false); }
  };
  if (!candidateIds.length) return null;
  return <div className="space-y-2"><div className="flex flex-wrap gap-3"><button disabled={!plus || busy} onClick={() => void exportReport('excel')} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Xuất Excel</button><button disabled={!plus || busy} onClick={() => void exportReport('print')} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">In / Lưu PDF</button>{!plus && <p className="self-center text-sm text-slate-500">Xuất báo cáo so sánh dành cho gói PLUS.</p>}</div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}
