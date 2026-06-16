import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { SettingsService } from './settings.service.js';
import { SettingsRepository } from './settings.repository.js';

const repo = new SettingsRepository();
const service = new SettingsService(repo);

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getSettings(
      req.query.doctor_id as string,
      req.auth!.clinicId
    );
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function putSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.putSettings(req.auth!.clinicId, req.body);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await service.createTemplate(req.auth!.clinicId, req.body);
    res.status(201).json(success(template));
  } catch (err) {
    next(err);
  }
}

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const templates = await service.listTemplates(
      req.auth!.clinicId,
      req.query.doctor_id as string | undefined
    );
    res.json(success(templates));
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const templateId = req.params.id as string;
    const template = await service.updateTemplate(templateId, req.auth!.clinicId, req.body);
    res.json(success(template));
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const templateId = req.params.id as string;
    await service.deleteTemplate(templateId, req.auth!.clinicId);
    res.json(success({ message: 'Template deleted' }));
  } catch (err) {
    next(err);
  }
}
