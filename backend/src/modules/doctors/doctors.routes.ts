import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { listDoctors, getDoctorProfile, getOwnDoctorProfile, updateOwnDoctorProfile, createVenue, getVenues, patchVenue } from './doctors.controller.js';

const router = Router();

const updateDoctorProfileSchema = z.object({
  title: z.enum(['Dr.', 'Prof.', 'Mr.', 'Ms.']).optional(),
  speciality: z.string().optional(),
  qualification: z.string().optional(),
  registration_number: z.string().optional(),
  bio: z.string().optional(),
  consultation_fee: z.number().positive().optional(),
  experience_years: z.number().int().min(0).optional(),
});

const createVenueSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
});

const updateVenueSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  is_active: z.boolean().optional(),
});

router.get('/doctors', authGuard, listDoctors);
router.get('/doctors/:doctorId/profile', authGuard, getDoctorProfile);
router.get('/doctor/profile', authGuard, requireRole('doctor'), getOwnDoctorProfile);
router.patch('/doctor/profile', authGuard, requireRole('doctor'), validate(updateDoctorProfileSchema), updateOwnDoctorProfile);
router.post('/venues', authGuard, requireRole('doctor', 'staff'), validate(createVenueSchema), createVenue);
router.get('/venues', authGuard, getVenues);
router.patch('/venues/:id', authGuard, requireRole('doctor', 'staff'), validate(updateVenueSchema), patchVenue);

export default router;
