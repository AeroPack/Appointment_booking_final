import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { success } from '../../utils/response.js';
import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';

const repo = new UsersRepository();
const service = new UsersService(repo);

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await service.getProfile(req.auth!.userId);
    res.json(success(user));
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await service.updateProfile(req.auth!.userId, req.body);
    res.json(success(user));
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
    }
    const filename = path.basename(file.path);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const avatarUrl = `${baseUrl}/uploads/avatars/${filename}`;
    const user = await service.updateAvatar(req.auth!.userId, avatarUrl);
    res.json(success(user));
  } catch (err) {
    next(err);
  }
}

export async function createDependent(req: Request, res: Response, next: NextFunction) {
  try {
    const dependent = await service.createDependent(
      req.auth!.userId,
      req.auth!.clinicId,
      req.body
    );
    res.status(201).json(success(dependent));
  } catch (err) {
    next(err);
  }
}

export async function getDependents(req: Request, res: Response, next: NextFunction) {
  try {
    const dependents = await service.getDependents(req.auth!.userId);
    res.json(success(dependents));
  } catch (err) {
    next(err);
  }
}

export async function updateDependent(req: Request, res: Response, next: NextFunction) {
  try {
    const dependent = await service.updateDependent(
      req.auth!.userId,
      req.params.id as string,
      req.body
    );
    res.json(success(dependent));
  } catch (err) {
    next(err);
  }
}

export async function deleteDependent(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteDependent(req.auth!.userId, req.params.id as string);
    res.json(success({ message: 'Dependent deleted' }));
  } catch (err) {
    next(err);
  }
}

export async function searchPatients(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string) || '';
    const patients = await service.searchPatients(req.auth!.clinicId, q);
    res.json(success(patients));
  } catch (err) {
    next(err);
  }
}

export async function createPatient(req: Request, res: Response, next: NextFunction) {
  try {
    const patient = await service.createPatient(req.auth!.clinicId, req.auth!.userId, req.body);
    res.status(201).json(success(patient));
  } catch (err) {
    next(err);
  }
}
