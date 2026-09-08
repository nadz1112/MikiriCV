import { Request, Response, NextFunction } from 'express';
import { matchingService } from '../services/matching.service.js';
import { ApiResponse } from '../types/index.js';

export class MatchingController {
  async runMatching(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const results = await matchingService.runMatching(req.body);
      res.json({
        success: true,
        message: `Hoàn tất đối soát và chấm điểm AI cho ${results.length} ứng viên`,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLeaderboard(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const leaderboard = await matchingService.getLeaderboardByJobId(req.params.jobDescriptionId);
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
