import { Request, Response, NextFunction } from 'express';
import { matchingService } from '../services/matching.service.js';
import { ApiResponse } from '../types/index.js';

export class MatchingController {
  async runMatching(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const results = await matchingService.runMatching(req.body, req.user!.id, res.locals.matchingOperationKey);
      res.json({
        success: true,
        message: `Hoàn tất đối soát và chấm điểm AI cho ${results.length} ứng viên`,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  async createMatchingJob(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const job = await matchingService.createMatchingJob(req.body, req.user!.id);
      res.setHeader('Location', `/api/matching/jobs/${job.id}`);
      res.status(202).json({
        success: true,
        message: `Đã tạo tiến trình đánh giá cho ${job.total} ứng viên`,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMatchingJob(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const includeItems = req.query.include === 'items';
      const job = await matchingService.getMatchingJob(req.params.id, req.user!, includeItems);
      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelMatchingJob(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const job = await matchingService.cancelMatchingJob(req.params.id, req.user!.id);
      res.status(202).json({
        success: true,
        message: 'Đã ghi nhận yêu cầu hủy tiến trình đánh giá',
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLeaderboard(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const leaderboard = await matchingService.getLeaderboardByJobId(req.params.jobDescriptionId, req.user?.role === 'ADMIN' ? undefined : req.user?.id);
      res.json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const matchingController = new MatchingController();
