import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { AppointmentsService } from './appointments.service.js';
import { AppointmentsRepository } from './appointments.repository.js';
import { messagesService } from '../messages/messages.controller.js';
import { tagsService } from '../tags/tags.controller.js';

const repo = new AppointmentsRepository();
const service = new AppointmentsService(repo);

export async function findSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.findSlots(req.auth!.clinicId, {
      doctor_id: req.query.doctor_id as string,
      from: req.query.from as string,
      to: req.query.to as string | undefined,
    });
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function bookSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.bookSlot(req.auth!.clinicId, req.auth!.userId, req.body);
    await messagesService.scheduleReminders(result.id);
    await tagsService.evaluateAutoTags(result.patient_id, req.auth!.clinicId);
    res.status(201).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function listAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as string | undefined;
    const appointments = await service.listAppointments(req.auth!.userId, status);
    res.json(success(appointments));
  } catch (err) {
    next(err);
  }
}

export async function getAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const appointment = await service.getAppointmentDetail(req.params.id as string, req.auth!.userId);
    res.json(success(appointment));
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.cancelAppointment(req.params.id as string, req.auth!.userId);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function updateAppointmentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateStatus(req.params.id as string, req.auth!.userId, req.body.status);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function bookOnBehalf(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.bookOnBehalf(req.auth!.clinicId, req.auth!.userId, req.body);
    await messagesService.scheduleReminders(result.id);
    await tagsService.evaluateAutoTags(result.patient_id, req.auth!.clinicId);
    res.status(201).json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function rescheduleAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.rescheduleAppointment(
      req.auth!.clinicId,
      req.auth!.userId,
      req.params.id as string,
      req.body
    );
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}
