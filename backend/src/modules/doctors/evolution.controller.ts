import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { evolutionService } from './evolution.service.js';

export async function connectWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    const doctorId = req.auth!.userId;
    const { phoneNumber } = req.body;

    const result = await evolutionService.connectDoctor(doctorId, phoneNumber);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getQrCode(req: Request, res: Response, next: NextFunction) {
  try {
    const doctorId = req.auth!.userId;
    const result = await evolutionService.getQrCode(doctorId);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function getWhatsAppStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const doctorId = req.auth!.userId;
    const result = await evolutionService.getStatus(doctorId);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function disconnectWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    const doctorId = req.auth!.userId;
    await evolutionService.disconnectDoctor(doctorId);
    res.json(success({ disconnected: true }));
  } catch (err) {
    next(err);
  }
}
