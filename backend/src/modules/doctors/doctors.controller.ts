import type { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response.js';
import { DoctorsService } from './doctors.service.js';
import { DoctorsRepository } from './doctors.repository.js';

const repo = new DoctorsRepository();
const service = new DoctorsService(repo);

export async function listDoctors(req: Request, res: Response, next: NextFunction) {
  try {
    const speciality = req.query.speciality as string | undefined;
    const doctors = await service.listDoctors(req.auth!.clinicId, speciality);
    res.json(success(doctors));
  } catch (err) {
    next(err);
  }
}

export async function getDoctorProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const doctorId = req.params.doctorId as string;
    const profile = await service.getDoctorProfile(doctorId, req.auth!.clinicId);
    res.json(success(profile));
  } catch (err) {
    next(err);
  }
}

export async function getOwnDoctorProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await service.getOwnDoctorProfile(req.auth!.userId, req.auth!.clinicId);
    res.json(success(profile));
  } catch (err) {
    next(err);
  }
}

export async function updateOwnDoctorProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await service.updateOwnDoctorProfile(req.auth!.userId, req.auth!.clinicId, req.body);
    res.json(success(profile));
  } catch (err) {
    next(err);
  }
}

export async function createVenue(req: Request, res: Response, next: NextFunction) {
  try {
    const venue = await service.createVenue(req.auth!.clinicId, req.body);
    res.status(201).json(success(venue));
  } catch (err) {
    next(err);
  }
}

export async function getVenues(req: Request, res: Response, next: NextFunction) {
  try {
    const venues = await service.getVenues(req.auth!.clinicId);
    res.json(success(venues));
  } catch (err) {
    next(err);
  }
}

export async function patchVenue(req: Request, res: Response, next: NextFunction) {
  try {
    const venueId = req.params.id as string;
    const venue = await service.updateVenue(venueId, req.auth!.clinicId, req.body);
    res.json(success(venue));
  } catch (err) {
    next(err);
  }
}

export async function getBookingPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const policies = await service.getBookingPolicies(req.auth!.userId);
    res.json(success(policies));
  } catch (err) {
    next(err);
  }
}

export async function updateBookingPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const policies = await service.updateBookingPolicies(req.auth!.userId, req.body);
    res.json(success(policies));
  } catch (err) {
    next(err);
  }
}

export async function getLeaves(req: Request, res: Response, next: NextFunction) {
  try {
    const leaves = await service.getLeaves(req.auth!.userId);
    res.json(success(leaves));
  } catch (err) {
    next(err);
  }
}

export async function createLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const leave = await service.createLeave(req.auth!.userId, req.body);
    res.status(201).json(success(leave));
  } catch (err) {
    next(err);
  }
}

export async function deleteLeave(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteLeave(req.params.id as string, req.auth!.userId);
    res.json(success({ deleted: true }));
  } catch (err) {
    next(err);
  }
}
