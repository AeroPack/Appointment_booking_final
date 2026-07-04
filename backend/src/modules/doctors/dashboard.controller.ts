import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardRepository } from './dashboard.repository.js';

const repo = new DashboardRepository();
const service = new DashboardService(repo);

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const stats = await service.getStats(req.auth!.userId, from, to);
    res.json(success(stats));
  } catch (err) {
    next(err);
  }
}

export async function getPatients(req: Request, res: Response, next: NextFunction) {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const patients = await service.getPatients(req.auth!.userId, from, to);
    res.json(success(patients));
  } catch (err) {
    next(err);
  }
}

export async function getVenueTypeStats(req: Request, res: Response, next: NextFunction) {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const stats = await service.getVenueTypeStats(req.auth!.userId, from, to);
    res.json(success(stats));
  } catch (err) {
    next(err);
  }
}
