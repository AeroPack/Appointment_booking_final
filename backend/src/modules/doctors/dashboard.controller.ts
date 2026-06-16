import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardRepository } from './dashboard.repository.js';

const repo = new DashboardRepository();
const service = new DashboardService(repo);

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date as string | undefined;
    const stats = await service.getStats(req.auth!.userId, date);
    res.json(success(stats));
  } catch (err) {
    next(err);
  }
}

export async function getTodayPatients(req: Request, res: Response, next: NextFunction) {
  try {
    const date = req.query.date as string | undefined;
    const patients = await service.getTodayPatients(req.auth!.userId, date);
    res.json(success(patients));
  } catch (err) {
    next(err);
  }
}
