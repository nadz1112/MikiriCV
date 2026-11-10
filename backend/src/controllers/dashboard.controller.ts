import type { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service.js';

export class DashboardController {
  async getStats(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Cache-Control', 'private, no-store');
    try { res.json({ success: true, data: await dashboardService.getDashboardStats(req.user!) }); }
    catch (error) { next(error); }
  }
  async getJobStats(req: Request, res: Response, next: NextFunction) {
    res.setHeader('Cache-Control', 'private, no-store');
    try { res.json({ success: true, data: await dashboardService.getJobStats(req.params.id, req.user!) }); }
    catch (error) { next(error); }
  }
}
export const dashboardController = new DashboardController();
