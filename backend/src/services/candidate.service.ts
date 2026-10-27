import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../middlewares/auth.middleware.js';
import { env } from '../config/env.js';
import { normalizeForSearch } from '../common/utils/normalize-for-search.js';
import { AppError } from '../common/errors/app-error.js';
import { CandidateRepository, candidateListSelect } from '../modules/candidates/candidate.repository.js';
import { toCandidateUploadDto } from '../modules/candidates/candidate.mapper.js';
import { ExtractorFactory } from '../modules/candidates/text-extractor.js';
import { FieldParser } from '../modules/candidates/field-parser.js';

const repo = new CandidateRepository();
const parser = new FieldParser();
const failedMessage = 'Không thể đọc nội dung văn bản. Vui lòng kiểm tra file không cài mật khẩu hoặc file ảnh scan chưa được hỗ trợ.';
const typeByExt: Record<string, string> = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
type UploadError = { fileName: string; code: 'FILE_TOO_LARGE' | 'UNSUPPORTED_FILE_TYPE'; message: string };

function appError(status: number, code: string, message: string) { return new AppError(status, code, message); }

export class CandidateService {
  async upload(files: Express.Multer.File[], idempotencyKey: string, user: AuthUser) {
    const removeTemporaryFiles = () => Promise.all(files.map((file) => fs.unlink(file.path).catch(() => undefined)));
    const requestHashParts = [];
    try {
      for (const file of files) requestHashParts.push({ name: file.originalname, size: file.size, hash: crypto.createHash('sha256').update(await fs.readFile(file.path)).digest('hex') });
    } catch (error) { await removeTemporaryFiles(); throw error; }
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ userId: user.id, files: requestHashParts })).digest('hex');
    const endpoint = '/api/candidates/upload';
    let record: Awaited<ReturnType<CandidateRepository['findIdempotency']>>;
    try { record = await repo.findIdempotency(idempotencyKey); }
    catch (error) { await removeTemporaryFiles(); throw error; }
    if (record) {
      await removeTemporaryFiles();
      if (record.endpoint !== endpoint || record.requestHash !== requestHash) throw appError(422, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key đã được dùng cho nội dung khác');
      if (record.statusCode === null) throw appError(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu tải lên đang được xử lý');
      return { status: record.statusCode, body: record.responseBody };
    }
    try {
      record = await repo.createIdempotency({ key: idempotencyKey, endpoint, requestHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    } catch (error) {
      await removeTemporaryFiles();
      if ((error as { code?: string }).code === 'P2002') throw appError(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu tải lên đang được xử lý');
      throw error;
    }

    const data: ReturnType<typeof toCandidateUploadDto>[] = [];
    const errors: UploadError[] = [];
    const processedPaths: string[] = [];
    try {
      for (const file of files) {
        const ext = path.extname(path.basename(file.originalname)).toLowerCase();
        const expectedMime = typeByExt[ext];
        if (file.size > env.MAX_FILE_SIZE_MB * 1024 * 1024) {
          errors.push({ fileName: file.originalname, code: 'FILE_TOO_LARGE', message: `Tệp vượt quá ${env.MAX_FILE_SIZE_MB} MB` });
          await fs.unlink(file.path).catch(() => undefined); continue;
        }
        if (!expectedMime || file.mimetype !== expectedMime) {
          errors.push({ fileName: file.originalname, code: 'UNSUPPORTED_FILE_TYPE', message: 'Chỉ chấp nhận tệp PDF hoặc DOCX hợp lệ' });
          await fs.unlink(file.path).catch(() => undefined); continue;
        }
        const bytes = await fs.readFile(file.path);
        const magicValid = ext === '.pdf' ? bytes.subarray(0, 5).toString('ascii') === '%PDF-' : bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
        if (!magicValid) {
          errors.push({ fileName: file.originalname, code: 'UNSUPPORTED_FILE_TYPE', message: 'Nội dung tệp không khớp với định dạng PDF/DOCX' });
          await fs.unlink(file.path).catch(() => undefined); continue;
        }
        processedPaths.push(file.path);
        const contentHash = crypto.createHash('sha256').update(bytes).digest('hex');
        const safeName = path.basename(file.originalname.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'ho-so';
        const storedName = `${crypto.randomUUID()}-${safeName}`;
        const storedPath = path.join(path.resolve(process.cwd(), env.UPLOAD_DIR), storedName);
        await fs.rename(file.path, storedPath);
        processedPaths[processedPaths.length - 1] = storedPath;
        let rawText = '';
        let extractionStatus: 'SUCCESS' | 'WARNING' | 'FAILED' = 'SUCCESS';
        let extractionMessage: string | null = null;
        let fields = parser.parse('', safeName);
        try {
          rawText = (await ExtractorFactory.create(expectedMime).extract(storedPath)).trim();
          if (!rawText) throw new Error('EMPTY_TEXT');
          fields = parser.parse(rawText, safeName);
          const missing: string[] = [];
          if (!fields.email) missing.push('email');
          if (!fields.phone) missing.push('số điện thoại');
          if (fields.skills.length === 0) missing.push('kỹ năng');
          if (missing.length) { extractionStatus = 'WARNING'; extractionMessage = `Đã đọc nội dung nhưng chưa tìm thấy ${missing.join(', ')}.`; }
        } catch {
          rawText = ''; extractionStatus = 'FAILED'; extractionMessage = failedMessage;
          fields = { ...parser.parse('', safeName), email: null, phone: null, skills: [], yearsOfExperience: 0 };
        }
        const candidate = await repo.create({
          fullName: fields.fullName, email: fields.email, phone: fields.phone, rawText,
          searchText: normalizeForSearch(`${fields.fullName} ${rawText}`), skills: fields.skills,
          yearsOfExperience: fields.yearsOfExperience, education: fields.education,
          fileName: safeName, fileUrl: storedPath, extractionStatus, extractionMessage, contentHash,
          owner: { connect: { id: user.id } }, uploadedBy: { connect: { id: user.id } },
        });
        processedPaths.splice(processedPaths.indexOf(storedPath), 1);
        data.push(toCandidateUploadDto(candidate));
      }

      const successful = data.filter((item) => item.extractionStatus === 'SUCCESS').length;
      const review = data.length - successful;
      const body = { success: errors.length === 0, message: `Đã xử lý ${successful} thành công, ${review} cần xem lại, ${errors.length} bị từ chối trên ${files.length} file`, data, errors };
      const status = data.length ? 200 : 422;
      await repo.finishIdempotency(idempotencyKey, status, body as Prisma.InputJsonValue);
      return { status, body };
    } catch (error) {
      await Promise.all(processedPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)));
      await repo.finishIdempotency(idempotencyKey, 500, { success: false, message: 'Không thể hoàn tất yêu cầu tải lên', data: [], errors: [] });
      throw error;
    } finally {
      await removeTemporaryFiles();
    }
  }

  async list(page: number, limit: number, user: AuthUser) {
    const where = user.role === 'ADMIN' ? {} : { ownerId: user.id };
    const [items, total] = await repo.findPage(where, (page - 1) * limit, limit);
    return { data: items.map((item) => {
      const { owner, ...candidate } = item;
      return { ...candidate, uploadedBy: user.role === 'ADMIN' ? (item.uploadedBy ?? owner) : null };
    }), total, page, limit };
  }

  async getFile(id: string, user: AuthUser) {
    const candidate = await repo.findOwned(id, user.role === 'ADMIN' ? undefined : user.id);
    if (!candidate) throw appError(404, 'CANDIDATE_NOT_FOUND', 'Không tìm thấy ứng viên');
    const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
    const filePath = candidate.fileUrl.startsWith('/uploads/')
      ? path.resolve(uploadRoot, path.basename(candidate.fileUrl))
      : path.resolve(candidate.fileUrl);
    if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) throw appError(404, 'FILE_NOT_FOUND', 'Không tìm thấy tệp CV gốc');
    await fs.access(filePath).catch(() => { throw appError(404, 'FILE_NOT_FOUND', 'Không tìm thấy tệp CV gốc'); });
    return { filePath, fileName: candidate.fileName, contentType: typeByExt[path.extname(candidate.fileName).toLowerCase()] ?? 'application/octet-stream' };
  }
}

export const candidateService = new CandidateService();
