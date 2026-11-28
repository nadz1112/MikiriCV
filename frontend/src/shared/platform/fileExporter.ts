import { api } from '../../services/api';
import { getCapacitor, isNativeMobile } from './runtime';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportComparisonReport(options: {
  jobId: string;
  candidateIds: string[];
  format: 'excel' | 'print';
}): Promise<void> {
  const { jobId, candidateIds, format } = options;
  const isPrint = format === 'print';
  const native = isNativeMobile();

  const printWindow = isPrint && !native ? window.open('', '_blank') : null;
  if (isPrint && !native && !printWindow) {
    throw new Error('POPUP_BLOCKED');
  }
  if (printWindow) printWindow.opener = null;

  try {
    const response = await api.post(
      '/matching/export',
      { jobId, candidateIds, format },
      { responseType: 'blob' },
    );
    const mime =
      format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/html;charset=utf-8';
    const fileName = format === 'excel' ? 'so-sanh-ung-vien.xlsx' : 'so-sanh-ung-vien.html';
    const blob = new Blob([response.data], { type: mime });

    if (native) {
      const plugins = getCapacitor()?.Plugins;
      if (plugins?.Filesystem?.writeFile && plugins?.Share?.share) {
        const base64 = await blobToBase64(blob);
        const writeResult = await plugins.Filesystem.writeFile({
          path: `cvmikiri-export/${Date.now()}-${fileName}`,
          data: base64,
          directory: 'CACHE',
          recursive: true,
        });
        await plugins.Share.share({
          title: 'Báo cáo so sánh ứng viên CVMikiri',
          url: writeResult.uri,
        });
        return;
      }
    }

    if (
      !isPrint &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function'
    ) {
      const file = new File([blob], fileName, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'Báo cáo so sánh ứng viên CVMikiri',
            files: [file],
          });
          return;
        } catch {
          // Fall back to direct download if user cancels share sheet.
        }
      }
    }

    const url = URL.createObjectURL(blob);
    if (printWindow) {
      printWindow.location.replace(url);
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    printWindow?.close();
    throw error;
  }
}
