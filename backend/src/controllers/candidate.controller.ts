import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import { candidateService } from '../services/candidate.service.js';
import { ApiResponse } from '../types/index.js';

export class CandidateController {
  async uploadCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) { res.status(400).json({ success: false, error: { code: 'NO_FILES', message: 'Vui lòng chọn ít nhất một tệp PDF hoặc DOCX' }, requestId: randomUUID() }); return; }
      const result = await candidateService.upload(files, req.get('Idempotency-Key')!, req.user!);
      res.status(result.status).json(result.body);
    } catch (error) { next(error); }
  }

  async getCandidates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as any;
      const result = await candidateService.list(query, req.user!);
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  }

  async getCandidateFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = await candidateService.getFile(req.params.id, req.user!);
      const disposition = req.query.download === '1' ? 'attachment' : 'inline';
      const encoded = encodeURIComponent(file.fileName).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
      const fallbackName = path.basename(file.fileName).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encoded}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(file.filePath, (error) => { if (error && !res.headersSent) next(error); });
    } catch (error) { next(error); }
  }

  async getCandidateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const candidate = await candidateService.getCandidateById(req.params.id, req.user!);
      res.json({
        success: true,
        data: candidate,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCandidate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await candidateService.deleteCandidate(req.params.id, req.user!);
      res.json({
        success: true,
        message: result.message || 'Đã xóa ứng viên và giải phóng tệp tin thành công',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const candidateController = new CandidateController();
