import { Request, Response, NextFunction } from 'express';
import { jobService } from '../services/job.service.js';
import { ApiResponse } from '../types/index.js';

export class JobController {
  async getAllJobs(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const jobs = await jobService.getAllJobs(req.user?.role === 'ADMIN' ? undefined : req.user?.id);
      res.json({
        success: true,
        data: jobs,
      });
    } catch (error) {
      next(error);
    }
  }

  async getJobById(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.getJobById(req.params.id, req.user?.role === 'ADMIN' ? undefined : req.user?.id);
      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  async createJob(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const newJob = await jobService.createJob(req.body, req.user!.id);
      res.status(201).json({
        success: true,
        message: 'Tạo Job Description thành công',
        data: newJob,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateJob(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      const updated = await jobService.updateJob(req.params.id, req.body, req.user?.role === 'ADMIN' ? undefined : req.user?.id);
      res.json({
        success: true,
        message: 'Cập nhật Job Description thành công',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteJob(req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> {
    try {
      await jobService.deleteJob(req.params.id, req.user?.role === 'ADMIN' ? undefined : req.user?.id);
      res.json({
        success: true,
        message: 'Đã xóa Job Description thành công',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const jobController = new JobController();
