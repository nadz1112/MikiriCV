import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CloudUpload, ExternalLink, FileText, LoaderCircle, RotateCcw, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCandidateStore } from '../store/useCandidateStore';
import { candidateApi } from '../services/candidateApi';
import { useAuthStore } from '../features/auth/authStore';
import type { Candidate } from '../types';

type UploadState = 'pending' | 'uploading' | 'parsed' | 'warning' | 'failed' | 'rejected';
interface UploadItem { id: string; file: File; state: UploadState; message?: string; progress: number; candidate?: Candidate; retryable?: boolean }
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = new Set(['.pdf', '.docx']);
const extOf = (name: string) => name.toLowerCase().slice(name.lastIndexOf('.'));

export const CandidatesPage: React.FC = () => {
  const { candidates, isLoading, page, total, fetchPage } = useCandidateStore();
  const user = useAuthStore((state) => state.user);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [batch, setBatch] = useState<{ files: File[]; key: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { void fetchPage(1); }, [fetchPage]);

  const onDrop = useCallback((accepted: File[], rejections: Array<{ file: File; errors: Array<{ code: string }> }>) => {
    setItems((current) => [...current,
      ...accepted.map((file) => ({ id: crypto.randomUUID(), file, state: 'pending' as const, progress: 0 })),
      ...rejections.map(({ file, errors }) => ({ id: crypto.randomUUID(), file, state: 'rejected' as const, progress: 0, message: errors.some((error) => error.code === 'file-too-large') ? 'Tệp vượt quá 10 MB' : errors.some((error) => error.code === 'too-many-files') ? 'Vượt quá số lượng tệp được chọn cho một lần' : `Chỉ chấp nhận tệp PDF hoặc DOCX (${extOf(file.name) || 'không rõ định dạng'})` })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, maxFiles: 20, maxSize: MAX_BYTES, accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } });

  const uploadFiles = async (files: File[], key: string, itemIds: string[]) => {
    if (sending) return;
    setSending(true);
    setBatch({ files, key });
    setItems((current) => current.map((item) => itemIds.includes(item.id) ? { ...item, state: 'uploading', progress: 0, message: undefined, retryable: false } : item));
    try {
      const response = await candidateApi.upload(files, key, (progress) => setItems((current) => current.map((item) => itemIds.includes(item.id) ? { ...item, progress } : item)));
      const successes = response.data.filter((candidate) => candidate.extractionStatus === 'SUCCESS').length;
      const review = response.data.filter((candidate) => candidate.extractionStatus === 'WARNING').length;
      const failed = response.data.filter((candidate) => candidate.extractionStatus === 'FAILED').length + response.errors.length;
      setItems((current) => {
        const unmatched = [...response.data];
        const errors = [...response.errors];
        return current.map((item) => {
        if (!itemIds.includes(item.id)) return item;
        const index = unmatched.findIndex((candidate) => candidate.fileName === item.file.name);
        if (index >= 0) {
          const [candidate] = unmatched.splice(index, 1);
          if (candidate.extractionStatus === 'SUCCESS') return { ...item, state: 'parsed', progress: 100, candidate, message: undefined };
          if (candidate.extractionStatus === 'WARNING') return { ...item, state: 'warning', progress: 100, candidate, message: candidate.extractionMessage || 'Cần xem lại thông tin trích xuất' };
          return { ...item, state: 'failed', progress: 100, candidate, message: candidate.extractionMessage || 'Không thể đọc nội dung CV' };
        }
        const errorIndex = errors.findIndex((error) => error.fileName === item.file.name);
        if (errorIndex >= 0) { const [error] = errors.splice(errorIndex, 1); return { ...item, state: 'failed', progress: 100, message: error.message }; }
        return item;
      });
      });
      toast.success(`Đã xử lý ${successes}/${files.length} hồ sơ thành công, ${failed} thất bại, ${review} cần xem lại`);
      setBatch(null);
      await fetchPage(1);
    } catch (error) {
      const payload = (error as { response?: { data?: { error?: { message?: string }; errors?: Array<{ fileName: string; message: string }>; data?: Candidate[] } } }).response?.data;
      const requestErrors = payload?.errors || [];
      const requestMessage = payload?.error?.message;
      if (requestErrors.length) {
        const failed = requestErrors.length;
        setItems((current) => {
          const remainingErrors = [...requestErrors];
          return current.map((item) => {
          if (!itemIds.includes(item.id)) return item;
          const index = remainingErrors.findIndex((entry) => entry.fileName === item.file.name);
          if (index < 0) return item;
          const [entry] = remainingErrors.splice(index, 1);
          return { ...item, state: 'failed', progress: 100, message: entry.message, retryable: false };
        });
        });
        setBatch(null);
        toast.error(`Không xử lý được ${failed}/${files.length} tệp. ${requestMessage || 'Hãy kiểm tra định dạng và dung lượng.'}`);
      } else {
        const message = requestMessage || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
        setItems((current) => current.map((item) => itemIds.includes(item.id) ? { ...item, state: 'failed', progress: 0, message, retryable: true } : item));
        setBatch({ files, key });
        toast.error(message);
      }
    } finally { setSending(false); }
  };

  const handleUpload = () => {
    const valid = items.filter((item) => item.state === 'pending' && ACCEPTED.has(extOf(item.file.name)) && item.file.size <= MAX_BYTES);
    if (!valid.length) { toast.error('Hãy chọn ít nhất một tệp PDF hoặc DOCX hợp lệ'); return; }
    const key = crypto.randomUUID();
    void uploadFiles(valid.map((item) => item.file), key, valid.map((item) => item.id));
  };

  const retry = () => {
    if (!batch) return;
    const failed = items.filter((item) => item.retryable && item.state === 'failed');
    if (failed.length) void uploadFiles(batch.files, batch.key, failed.map((item) => item.id));
  };

  const statusIcon = (item: UploadItem) => {
    if (item.state === 'uploading') return <LoaderCircle className="h-4 w-4 animate-spin text-blue-600"/>;
    if (item.state === 'parsed') return <CheckCircle2 className="h-4 w-4 text-emerald-600"/>;
    if (item.state === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600"/>;
    if (item.state === 'failed' || item.state === 'rejected') return <XCircle className="h-4 w-4 text-red-600"/>;
    return <FileText className="h-4 w-4 text-slate-400"/>;
  };

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Quản lý CV</h1><p className="mt-1 text-sm text-slate-500">Tải lên nhiều hồ sơ PDF hoặc DOCX để trích xuất thông tin ứng viên.</p></div>

    <div {...getRootProps()} className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400'}`}>
      <input {...getInputProps()}/><CloudUpload className="mx-auto h-9 w-9 text-blue-600"/>
      <p className="mt-3 font-semibold text-slate-800">Kéo thả file PDF/DOCX vào đây, hoặc bấm để chọn (tối đa 10MB/file)</p>
      <p className="mt-1 text-xs text-slate-500">Có thể chọn nhiều tệp cùng lúc.</p>
    </div>

    {items.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <ul className="divide-y divide-slate-100">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
        {statusIcon(item)}<div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{item.file.name}</div>{item.state === 'uploading' && <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${item.progress}%` }}/></div>}{item.message && <p className={`mt-1 text-xs ${item.state === 'warning' ? 'text-amber-700' : 'text-red-700'}`}>{item.message}</p>}</div>
        <span className="text-xs text-slate-500">{item.state === 'pending' ? 'Chờ tải lên' : item.state === 'uploading' ? 'Đang tải lên' : item.state === 'parsed' ? 'Đã trích xuất' : item.state === 'warning' ? 'Cần xem lại' : item.state === 'rejected' ? 'Bị từ chối' : 'Thất bại'}</span>
        {item.retryable && <button type="button" disabled={sending} onClick={retry} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-blue-700 disabled:opacity-50"><RotateCcw size={13}/>Thử lại</button>}
        {(item.state === 'pending' || item.state === 'rejected') && <button type="button" onClick={() => setItems((current) => current.filter(({ id }) => id !== item.id))} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">Xóa khỏi danh sách</button>}
      </li>)}</ul>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setItems([])} disabled={sending} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">Xóa danh sách</button><button type="button" onClick={handleUpload} disabled={sending || !items.some((item) => item.state === 'pending')} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Đang xử lý…' : 'Tải CV lên'}</button></div>
    </section>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-4"><div><h2 className="font-semibold">Danh sách ứng viên</h2><p className="text-xs text-slate-500">{total} hồ sơ</p></div></div>
      {isLoading ? <div className="p-12 text-center text-sm text-slate-500">Đang tải danh sách hồ sơ…</div> : candidates.length === 0 ? <div className="p-12 text-center"><FileText className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 font-medium text-slate-700">Chưa có hồ sơ CV</p><p className="mt-1 text-sm text-slate-500">Kéo thả PDF hoặc DOCX vào khu vực phía trên để bắt đầu.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Họ tên</th><th className="p-3">Email</th><th className="p-3">SĐT</th><th className="p-3">Kinh nghiệm</th><th className="p-3">Kỹ năng</th><th className="p-3">Trích xuất</th>{user?.role === 'ADMIN' && <th className="p-3">Người upload</th>}<th className="p-3">Ngày tải lên</th><th className="p-3">CV gốc</th></tr></thead><tbody className="divide-y divide-slate-100">{candidates.map((candidate) => <tr key={candidate.id} className="align-top hover:bg-slate-50"><td className="p-3 font-medium">{candidate.fullName}{candidate.extractionStatus === 'FAILED' && <div className="mt-1 text-xs font-normal text-amber-700">Cần xem lại thủ công</div>}</td><td className="p-3">{candidate.email || '—'}</td><td className="p-3">{candidate.phone || '—'}</td><td className="p-3">{candidate.yearsOfExperience} năm</td><td className="p-3"><div className="flex max-w-56 flex-wrap gap-1">{candidate.skills.map((skill) => <span key={skill} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{skill}</span>)}</div></td><td className="p-3"><span title={candidate.extractionMessage || undefined} className={`rounded-full px-2 py-1 text-[10px] font-bold ${candidate.extractionStatus === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : candidate.extractionStatus === 'WARNING' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{candidate.extractionStatus || 'SUCCESS'}</span>{candidate.extractionMessage && <span className="ml-1 cursor-help text-slate-400" title={candidate.extractionMessage}>ⓘ</span>}</td>{user?.role === 'ADMIN' && <td className="p-3">{candidate.uploadedBy?.fullName || '—'}</td>}<td className="whitespace-nowrap p-3">{new Date(candidate.createdAt).toLocaleDateString('vi-VN')}</td><td className="p-3"><button type="button" onClick={() => window.open(`/api/candidates/${candidate.id}/file`, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 whitespace-nowrap text-blue-700 hover:underline"><ExternalLink size={14}/>Xem CV gốc</button></td></tr>)}</tbody></table></div>}
      {total > 50 && <div className="flex items-center justify-between border-t px-4 py-3 text-sm"><span className="text-slate-500">Trang {page} / {Math.ceil(total / 50)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1 || isLoading} onClick={() => void fetchPage(page - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={16}/></button><button type="button" disabled={page >= Math.ceil(total / 50) || isLoading} onClick={() => void fetchPage(page + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight size={16}/></button></div></div>}
    </section>
  </div>;
};
