import React from 'react';
import { AlertTriangle, CloudOff, LoaderCircle, RefreshCw } from 'lucide-react';
import { useSafeAuth } from '../../features/auth/useSafeAuth';
import { useNetworkStore } from '../../shared/offline/networkStore';
import { processOutboxQueue } from '../../shared/offline/syncQueue';
import { offlineDb } from '../../shared/offline/offlineDb';

export const NetworkStatusBanner: React.FC = () => {
  const { user, isOfflineSession } = useSafeAuth();
  const { isOnline, isSyncing, pendingCount, conflictCount, refreshQueueCounts } = useNetworkStore();

  if (!user) return null;
  if (isOnline && !isSyncing && pendingCount === 0 && conflictCount === 0 && !isOfflineSession) {
    return null;
  }

  const handleClearConflicts = async () => {
    const items = await offlineDb.listOutbox(user.id);
    await Promise.all(
      items.filter((item) => item.status === 'conflict').map((item) => offlineDb.removeOutboxItem(item.id)),
    );
    await refreshQueueCounts(user.id);
  };

  return (
    <div
      role="status"
      className={`border-b px-4 py-2 text-xs font-medium ${
        !isOnline
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : conflictCount > 0
            ? 'border-rose-200 bg-rose-50 text-rose-900'
            : 'border-blue-200 bg-blue-50 text-blue-900'
      }`}
    >
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-2 sm:px-2 md:px-4">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <CloudOff className="h-4 w-4 shrink-0 text-amber-700" />
              <span>
                Đang ở chế độ ngoại tuyến — Bạn vẫn có thể xem dữ liệu đã lưu và chuẩn bị nháp JD/CV.
                {pendingCount > 0 ? ` (${pendingCount} mục chờ đồng bộ)` : ''}
              </span>
            </>
          ) : isSyncing ? (
            <>
              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-blue-700" />
              <span>Đang đồng bộ {pendingCount} mục dữ liệu ngoại tuyến lên máy chủ...</span>
            </>
          ) : conflictCount > 0 ? (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-700" />
              <span>
                Có {conflictCount} Job Description xung đột phiên bản với máy chủ khi đồng bộ.
              </span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 shrink-0 text-blue-700" />
              <span>
                {pendingCount > 0
                  ? `Có ${pendingCount} mục ngoại tuyến đang chờ đồng bộ.`
                  : 'Đang xác thực lại phiên làm việc ngoại tuyến...'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isOnline && pendingCount > conflictCount && !isSyncing && (
            <button
              type="button"
              onClick={() => void processOutboxQueue(user.id)}
              className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
            >
              Đồng bộ ngay
            </button>
          )}
          {conflictCount > 0 && (
            <button
              type="button"
              onClick={() => void handleClearConflicts()}
              className="rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
            >
              Bỏ bản nháp xung đột
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
