import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { getMe, updateMe, createDependent, getDependents, updateDependent, deleteDependent, searchPatients, createPatient } from './users.controller.js';

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  date_of_birth: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
});

const createDependentSchema = z.object({
  name: z.string().min(1),
  mobile_number: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  relationship: z.string().optional(),
  date_of_birth: z.string().optional(),
});

const updateDependentSchema = z.object({
  name: z.string().min(1).optional(),
  mobile_number: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  relationship: z.string().optional(),
  date_of_birth: z.string().optional(),
});

const searchPatientsSchema = z.object({
  q: z.string().min(1),
});

const createPatientSchema = z.object({
  name: z.string().min(1),
  mobile_number: z.string().max(20).optional(),
  email: z.string().email().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
});

router.get('/users/me', authGuard, getMe);
router.patch('/users/me', authGuard, validate(updateProfileSchema), updateMe);
router.post('/users/dependents', authGuard, validate(createDependentSchema), createDependent);
router.get('/users/dependents', authGuard, getDependents);
router.patch('/users/dependents/:id', authGuard, validate(updateDependentSchema), updateDependent);
router.delete('/users/dependents/:id', authGuard, deleteDependent);
router.get('/patients/search', authGuard, requireRole('doctor', 'staff'), validate(searchPatientsSchema, 'query'), searchPatients);
router.post('/patients', authGuard, requireRole('doctor', 'staff'), validate(createPatientSchema), createPatient);

export default router;
