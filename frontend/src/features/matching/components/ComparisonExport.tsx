import { useState } from 'react';
import { exportComparisonReport } from '../../../shared/platform/fileExporter';
import { useNetworkStore } from '../../../shared/offline/networkStore';

export function ComparisonExport({ jobId, candidateIds, plus }: { jobId: string; candidateIds: string[]; plus: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isOnline = useNetworkStore((state) => state.isOnline);
  const exportReport = async (format: 'excel' | 'print') => {
    if (busy || !isOnline) return;
    setBusy(true); setError('');
    try {
      await exportComparisonReport({ jobId, candidateIds, format });
    } catch (err) {
      if (err instanceof Error && err.message === 'POPUP_BLOCKED') {
        setError('Vui lòng cho phép mở cửa sổ để in / lưu PDF.');
      } else {
        setError('Không thể xuất báo cáo. Vui lòng kiểm tra quyền gói PLUS và thử lại.');
      }
    }
    finally { setBusy(false); }
  };
  if (!candidateIds.length) return null;
  return <div className="space-y-2"><div className="flex flex-wrap gap-3"><button disabled={!plus || busy || !isOnline} onClick={() => void exportReport('excel')} className="min-h-[40px] rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Xuất Excel</button><button disabled={!plus || busy || !isOnline} onClick={() => void exportReport('print')} className="min-h-[40px] rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">In / Lưu PDF</button>{!plus && <p className="self-center text-sm text-slate-500">Xuất báo cáo so sánh dành cho gói PLUS.</p>}{plus && !isOnline && <p className="self-center text-xs text-amber-700">Cần kết nối mạng để xuất báo cáo so sánh.</p>}</div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;
}
