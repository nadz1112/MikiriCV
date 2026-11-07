import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { ApiResponse, DashboardStats } from '../types/index.js';

export class DashboardController {
  async getStats(
    req: Request,
    res: Response<ApiResponse<DashboardStats>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await dashboardService.getDashboardStats(req.user);
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();

