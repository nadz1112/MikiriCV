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
    const safeOriginal = path.basename(file.originalname.replace(/\\/g, '/'));
    const ext = path.extname(safeOriginal).toLowerCase();
    const baseName = path.basename(safeOriginal, ext).replace(/[\x00-\x1f\x7f]/g, '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'ho-so';
    cb(null, `${uniqueId}-${baseName}${ext}`);
  },
});

const fileFilter = (_req: Express.Request, _file: Express.Multer.File, cb: multer.FileFilterCallback) => cb(null, true);

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    files: env.MAX_FILES_PER_REQUEST,
  },
});
