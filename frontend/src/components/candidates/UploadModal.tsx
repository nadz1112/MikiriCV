import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { candidateApi } from '../../services/candidateApi';
import toast from 'react-hot-toast';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...acceptedFiles]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng chọn ít nhất một file CV (.pdf, .docx)');
      return;
    }

    setIsUploading(true);
    try {
      const res = await candidateApi.upload(selectedFiles);
      toast.success(res.message || 'Tải lên và trích xuất hồ sơ thành công!');
      setSelectedFiles([]);
      onSuccess();
      onClose();
    } catch {
      // Axios interceptor đã xử lý toast
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Tải lên hồ sơ ứng viên (CV)</h3>
              <p className="text-xs text-slate-400">Tự động trích xuất nội dung và kỹ năng</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-8 h-8 mx-auto text-blue-600 mb-2" />
          <p className="text-xs sm:text-sm font-semibold text-slate-700">
            {isDragActive ? 'Thả các tệp CV vào đây' : 'Kéo thả file CV vào đây, hoặc click để chọn'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Hỗ trợ định dạng .PDF, .DOCX. Tối đa 10MB mỗi file.
          </p>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            <span className="text-[11px] font-semibold text-slate-500">
              Các tệp đã chọn ({selectedFiles.length}):
            </span>
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700"
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  disabled={isUploading}
                  className="text-slate-400 hover:text-red-500 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Modal Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleUploadSubmit}
            disabled={isUploading || selectedFiles.length === 0}
            className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {isUploading ? (
              <span>Đang trích xuất dữ liệu...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Tiến hành tải lên ({selectedFiles.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
