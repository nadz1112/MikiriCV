import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  CloudUpload,
  FileText,
  LoaderCircle,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { candidateApi, CandidateItem } from '../api/candidateApi';
import { useSubscriptionStore } from '../../subscription/subscriptionStore';
import { useSafeAuth } from '../../auth/useSafeAuth';
import { useNetworkStore } from '../../../shared/offline/networkStore';
import { offlineDb } from '../../../shared/offline/offlineDb';
import { isNetworkOfflineError } from '../../../shared/platform/runtime';
import { useIsMobileViewport } from '../../../shared/hooks/useIsMobileViewport';

export type UploadState = 'pending' | 'uploading' | 'queued_offline' | 'parsed' | 'warning' | 'failed' | 'rejected';

export interface UploadItem {
  id: string;
  file: File;
  state: UploadState;
  message?: string;
  progress: number;
  candidate?: CandidateItem;
  retryable?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = new Set(['.pdf', '.docx']);
const extOf = (name: string) => {
  const dotIdx = name.lastIndexOf('.');
  return dotIdx >= 0 ? name.toLowerCase().slice(dotIdx) : '';
};

interface CvDropzoneProps {
  onUploadSuccess?: () => void;
  plan?: 'FREE' | 'PLUS';
}

export const CvDropzone: React.FC<CvDropzoneProps> = ({ onUploadSuccess, plan }) => {
  const storePlan = useSubscriptionStore((state) => state.subscription?.name);
  const storeBulk = useSubscriptionStore((state) => state.subscription?.bulk);
  const isFreePlan = storeBulk != null ? !storeBulk : (plan ?? storePlan) === 'FREE';
  const { user } = useSafeAuth();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const isMobile = useIsMobileViewport();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [batch, setBatch] = useState<{ files: File[]; key: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onSynced = () => {
      setItems((current) => current.filter((item) => item.state !== 'queued_offline'));
      onUploadSuccess?.();
    };
    window.addEventListener('offline:synced', onSynced);
    return () => window.removeEventListener('offline:synced', onSynced);
  }, [onUploadSuccess]);

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    setItems((current) => {
      const base = isFreePlan && accepted.length > 0
        ? current.filter((item) => item.state !== 'pending')
        : current;
      const acceptedFiles = isFreePlan ? accepted.slice(0, 1) : accepted;
      return [
        ...base,
        ...acceptedFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          state: 'pending' as const,
          progress: 0,
        })),
        ...rejections.map(({ file, errors }) => ({
          id: crypto.randomUUID(),
          file,
          state: 'rejected' as const,
          progress: 0,
          message: errors.some((error) => error.code === 'file-too-large')
            ? 'Sai định dạng/Quá 10MB: Tệp vượt quá giới hạn 10 MB'
            : errors.some((error) => error.code === 'too-many-files')
              ? isFreePlan
                ? 'Gói FREE chỉ tải lên từng CV đơn lẻ. Vui lòng chọn 1 tệp hoặc nâng gói PLUS để tải hàng loạt.'
                : 'Vượt quá số lượng tệp được chọn cho một lần (tối đa 20 tệp)'
              : `Sai định dạng: Chỉ chấp nhận tệp PDF hoặc DOCX (${extOf(file.name) || 'không rõ định dạng'})`,
        })),
      ];
    });
  }, [isFreePlan]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: !isFreePlan,
    maxFiles: isFreePlan ? 1 : 20,
    maxSize: MAX_BYTES,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  });

  const uploadFiles = async (files: File[], key: string, itemIds: string[]) => {
    if (sending) return;
    setSending(true);
    setBatch({ files, key });
    setItems((current) =>
      current.map((item) =>
        itemIds.includes(item.id)
          ? { ...item, state: 'uploading', progress: 0, message: undefined, retryable: false }
          : item,
      ),
    );

    try {
      const response = await candidateApi.upload(files, key, (progress) =>
        setItems((current) =>
          current.map((item) => (itemIds.includes(item.id) ? { ...item, progress } : item)),
        ),
      );

      const successes = response.data.filter(
        (candidate) => candidate.extractionStatus === 'SUCCESS',
      ).length;
      const review = response.data.filter(
        (candidate) =>
          candidate.extractionStatus === 'WARNING' || candidate.extractionStatus === 'FAILED',
      ).length;
      const failed = response.errors.length;

      setItems((current) => {
        const unmatched = [...response.data];
        const errors = [...response.errors];
        return current.map((item) => {
          if (!itemIds.includes(item.id)) return item;
          const index = unmatched.findIndex((candidate) => candidate.fileName === item.file.name);
          if (index >= 0) {
            const [candidate] = unmatched.splice(index, 1);
            if (candidate.extractionStatus === 'SUCCESS') {
              return { ...item, state: 'parsed', progress: 100, candidate, message: undefined };
            }
            return {
              ...item,
              state: 'warning',
              progress: 100,
              candidate,
              message:
                candidate.extractionMessage ||
                'Không đọc được đầy đủ văn bản (file scan/rỗng), cần xem lại thủ công',
            };
          }
          const errorIndex = errors.findIndex((error) => error.fileName === item.file.name);
          if (errorIndex >= 0) {
            const [error] = errors.splice(errorIndex, 1);
            return { ...item, state: 'failed', progress: 100, message: error.message };
          }
          return item;
        });
      });

      toast.success(
        `Đã xử lý ${successes}/${files.length} hồ sơ thành công, ${failed} thất bại, ${review} cần xem lại`,
      );
      setBatch(null);
      onUploadSuccess?.();
    } catch (error) {
      const payload = (
        error as {
          response?: {
            data?: {
              error?: { message?: string };
              errors?: Array<{ fileName: string; message: string }>;
              data?: CandidateItem[];
            };
          };
        }
      ).response?.data;

      const requestErrors = payload?.errors || [];
      const requestMessage = payload?.error?.message;

      if (requestErrors.length > 0) {
        const failed = requestErrors.length;
        setItems((current) => {
          const remainingErrors = [...requestErrors];
          return current.map((item) => {
            if (!itemIds.includes(item.id)) return item;
            const index = remainingErrors.findIndex((entry) => entry.fileName === item.file.name);
            if (index < 0) return item;
            const [entry] = remainingErrors.splice(index, 1);
            return {
              ...item,
              state: 'failed',
              progress: 100,
              message: entry.message,
              retryable: false,
            };
          });
        });
        setBatch(null);
        toast.error(
          `Không xử lý được ${failed}/${files.length} tệp. ${requestMessage || 'Hãy kiểm tra định dạng và dung lượng.'}`,
        );
      } else if (isNetworkOfflineError(error) && user?.id) {
        try {
          await offlineDb.enqueueUploadCv(user.id, files, key);
          void useNetworkStore.getState().refreshQueueCounts(user.id);
          setItems((current) =>
            current.map((item) =>
              itemIds.includes(item.id)
                ? {
                    ...item,
                    state: 'queued_offline',
                    progress: 0,
                    message: 'Đang mất mạng — đã lưu vào hàng đợi và sẽ tự tải lên khi có mạng.',
                    retryable: false,
                  }
                : item,
            ),
          );
          setBatch(null);
          toast.success(`Đã đưa ${files.length} tệp vào hàng đợi tải lên ngoại tuyến`);
        } catch (queueError) {
          const message =
            queueError instanceof Error ? queueError.message : 'Không thể lưu hàng đợi ngoại tuyến.';
          setItems((current) =>
            current.map((item) =>
              itemIds.includes(item.id)
                ? { ...item, state: 'failed', progress: 0, message, retryable: true }
                : item,
            ),
          );
          toast.error(message);
        }
      } else {
        const message = requestMessage || 'Mất kết nối máy chủ, chưa xác nhận được trạng thái. Vui lòng thử lại.';
        setItems((current) =>
          current.map((item) =>
            itemIds.includes(item.id)
              ? { ...item, state: 'failed', progress: 0, message, retryable: true }
              : item,
          ),
        );
        setBatch({ files, key });
        toast.error(message);
      }
    } finally {
      setSending(false);
    }
  };

  const handleUpload = async () => {
    const valid = items.filter(
      (item) =>
        item.state === 'pending' &&
        ACCEPTED.has(extOf(item.file.name)) &&
        item.file.size <= MAX_BYTES,
    );
    if (!valid.length) {
      toast.error('Hãy chọn ít nhất một tệp PDF hoặc DOCX hợp lệ');
      return;
    }
    const key = crypto.randomUUID();
    const validFiles = valid.map((item) => item.file);
    const validIds = valid.map((item) => item.id);

    if (!isOnline) {
      if (!user?.id) {
        toast.error('Không xác định được phiên tài khoản để lưu hàng đợi ngoại tuyến.');
        return;
      }
      setSending(true);
      try {
        await offlineDb.enqueueUploadCv(user.id, validFiles, key);
        await useNetworkStore.getState().refreshQueueCounts(user.id);
        setItems((current) =>
          current.map((item) =>
            validIds.includes(item.id)
              ? {
                  ...item,
                  state: 'queued_offline',
                  progress: 0,
                  message: 'Đang ngoại tuyến — sẽ tự động tải lên khi có mạng trở lại.',
                }
              : item,
          ),
        );
        toast.success(`Đã lưu ${validFiles.length} tệp vào hàng đợi ngoại tuyến`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không thể lưu hàng đợi ngoại tuyến');
      } finally {
        setSending(false);
      }
      return;
    }

    void uploadFiles(validFiles, key, validIds);
  };

  const handleRetryFile = (item: UploadItem) => {
    if (sending) return;
    const key = batch?.key || crypto.randomUUID();
    void uploadFiles([item.file], key, [item.id]);
  };

  const handleRetryAllFailed = () => {
    if (!batch || sending) return;
    const failed = items.filter((item) => item.retryable && item.state === 'failed');
    if (failed.length) {
      void uploadFiles(
        failed.map((item) => item.file),
        batch.key,
        failed.map((item) => item.id),
      );
    }
  };

  const statusIcon = (item: UploadItem) => {
    if (item.state === 'uploading') {
      return <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-blue-600" />;
    }
    if (item.state === 'queued_offline') {
      return <CloudOff className="h-4 w-4 shrink-0 text-amber-600" />;
    }
    if (item.state === 'parsed') {
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
    }
    if (item.state === 'warning') {
      return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />;
    }
    if (item.state === 'failed' || item.state === 'rejected') {
      return <XCircle className="h-4 w-4 shrink-0 text-rose-600" />;
    }
    return <FileText className="h-4 w-4 shrink-0 text-slate-400" />;
  };

  const statusLabel = (state: UploadState) => {
    switch (state) {
      case 'pending':
        return 'Chờ tải lên';
      case 'uploading':
        return 'Đang tải lên...';
      case 'queued_offline':
        return 'Chờ mạng để tải';
      case 'parsed':
        return 'Đã trích xuất';
      case 'warning':
        return 'Cần xem lại';
      case 'rejected':
        return 'Sai định dạng / Quá 10MB';
      case 'failed':
        return 'Thất bại';
    }
  };

  const pendingCount = items.filter((item) => item.state === 'pending').length;
  const retryableCount = items.filter((item) => item.retryable && item.state === 'failed').length;

  return (
    <div className="space-y-3">
      {/* Khu vực kéo-thả (Dropzone) */}
      <div
        {...getRootProps()}
        className={`group cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-50/70 ring-4 ring-blue-100'
            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:scale-105 group-hover:bg-blue-100">
          <CloudUpload className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          {isMobile
            ? isFreePlan
              ? 'Chạm để chọn 1 file PDF/DOCX từ điện thoại, Drive hoặc iCloud'
              : 'Chạm để chọn file PDF/DOCX từ điện thoại, Drive hoặc iCloud (≤ 10MB)'
            : isFreePlan
              ? 'Kéo thả 1 file PDF/DOCX vào đây, hoặc bấm để chọn (≤ 2 trang PDF / ~3.000 ký tự)'
              : 'Kéo thả file PDF/DOCX vào đây, hoặc bấm để chọn (≤ 10MB/file)'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {isFreePlan
            ? 'Gói FREE: Xử lý từng CV đơn lẻ. Nâng cấp Gói PLUS để tải hàng loạt tối đa 20 tệp & hồ sơ tới 6 trang.'
            : 'Hỗ trợ tải lên hàng loạt tối đa 20 tệp cùng lúc (tối đa 6 trang PDF / ~12.000 ký tự mỗi CV).'}
        </p>
      </div>

      {/* Hàng đợi trạng thái từng file */}
      {items.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Danh sách tệp ({items.length})
            </span>
            {retryableCount > 1 && (
              <button
                type="button"
                disabled={sending}
                onClick={handleRetryAllFailed}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Thử lại tất cả tệp lỗi ({retryableCount})</span>
              </button>
            )}
          </div>

          <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto pr-1">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                {statusIcon(item)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">
                      {item.file.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      ({(item.file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>

                  {item.state === 'uploading' && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-blue-600 transition-all duration-200"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-blue-600">
                        {item.progress}%
                      </span>
                    </div>
                  )}

                  {item.message && (
                    <p
                      className={`mt-1 text-xs ${
                        item.state === 'warning' || item.state === 'queued_offline' ? 'text-amber-700' : 'text-rose-600'
                      }`}
                    >
                      {item.message}
                    </p>
                  )}
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    item.state === 'parsed'
                      ? 'bg-emerald-50 text-emerald-700'
                      : item.state === 'warning' || item.state === 'queued_offline'
                        ? 'bg-amber-50 text-amber-700'
                        : item.state === 'failed' || item.state === 'rejected'
                          ? 'bg-rose-50 text-rose-700'
                          : item.state === 'uploading'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {statusLabel(item.state)}
                </span>

                {item.retryable && item.state === 'failed' && (
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => handleRetryFile(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Thử lại</span>
                  </button>
                )}

                {item.state !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) => current.filter(({ id }) => id !== item.id))
                    }
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Xóa khỏi danh sách"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">
              {pendingCount > 0
                ? `${pendingCount} tệp hợp lệ sẵn sàng tải lên`
                : 'Đã xử lý xong các tệp trong danh sách'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setItems([])}
                disabled={sending}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Xóa danh sách
              </button>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={sending || pendingCount === 0}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {sending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {sending
                    ? 'Đang xử lý...'
                    : !isOnline
                      ? `Lưu chờ mạng (${pendingCount})`
                      : `Tải CV lên (${pendingCount})`}
                </span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
