import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { CustomStatusesService } from './custom-statuses.service.js';
import { CustomStatusesRepository } from './custom-statuses.repository.js';

const repo = new CustomStatusesRepository();
export const customStatusesService = new CustomStatusesService(repo);

export async function createStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await customStatusesService.createStatus(req.auth!.clinicId, req.body);
    res.status(201).json(success(status));
  } catch (err) {
    next(err);
  }
}

export async function listStatuses(req: Request, res: Response, next: NextFunction) {
  try {
    const statuses = await customStatusesService.listStatuses(req.auth!.clinicId);
    res.json(success(statuses));
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await customStatusesService.getStatus(req.params.id as string, req.auth!.clinicId);
    res.json(success(status));
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = await customStatusesService.updateStatus(req.params.id as string, req.auth!.clinicId, req.body);
    res.json(success(status));
  } catch (err) {
    next(err);
  }
}

export async function deleteStatus(req: Request, res: Response, next: NextFunction) {
  try {
    await customStatusesService.deleteStatus(req.params.id as string, req.auth!.clinicId);
    res.json(success(null));
  } catch (err) {
    next(err);
  }
}
