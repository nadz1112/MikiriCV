import { Request, Response, NextFunction } from 'express';
import { candidateService } from '../services/candidate.service.js';
import { ApiResponse } from '../types/index.js';

export class CandidateController {
  async uploadCandidates(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Vui lòng chọn ít nhất một file CV (.pdf hoặc .docx) để tải lên',
        });
        return;
      }

      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          const candidate = await candidateService.processAndSaveUploadedFile(file);
          results.push(candidate);
        } catch (err) {
          errors.push({
            fileName: file.originalname,
            error: err instanceof Error ? err.message : 'Lỗi không xác định',
          });
        }
      }

      res.status(201).json({
        success: results.length > 0,
        message: `Đã xử lý thành công ${results.length}/${files.length} hồ sơ`,
        data: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCandidates(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const candidates = await candidateService.getFilteredCandidates(req.query);
      res.json({
        success: true,
        data: candidates,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCandidateById(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const candidate = await candidateService.getCandidateById(req.params.id);
      res.json({
        success: true,
        data: candidate,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCandidate(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      await candidateService.deleteCandidate(req.params.id);
      res.json({
        success: true,
        message: 'Đã xóa ứng viên và giải phóng tệp tin thành công',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const candidateController = new CandidateController();
