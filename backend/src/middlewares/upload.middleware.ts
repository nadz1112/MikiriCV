import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Giữ tên file gốc có gắn UUID phía trước để tránh trùng lặp
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9-]/g, '_');
    cb(null, `${uniqueId}_${baseName}${ext}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.pdf', '.docx'];
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream', // Một số trình duyệt gửi file docx dưới dạng octet-stream
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`Định dạng tệp không được chấp nhận. Hệ thống chỉ hỗ trợ ${allowedExtensions.join(', ')}`));
  }

  // Từ chối nếu mimetype bị thiếu hoặc rỗng
  if (!file.mimetype || typeof file.mimetype !== 'string' || file.mimetype.trim() === '') {
    return cb(new Error('Kiểu MIME của tệp bị thiếu hoặc rỗng. Vui lòng tải lên tệp hợp lệ.'));
  }

  const normalizedMime = file.mimetype.trim().toLowerCase();
  if (!allowedMimeTypes.includes(normalizedMime)) {
    return cb(new Error(`Loại nội dung file không hợp lệ (${file.mimetype}). Chỉ chấp nhận tài liệu PDF và DOCX.`));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});
