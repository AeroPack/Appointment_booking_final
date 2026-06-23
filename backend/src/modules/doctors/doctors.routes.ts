import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middleware/authGuard.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  listDoctors, getDoctorProfile, getOwnDoctorProfile, updateOwnDoctorProfile,
  createVenue, getVenues, patchVenue,
  getBookingPolicies, updateBookingPolicies,
  getLeaves, createLeave, deleteLeave,
} from './doctors.controller.js';

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

const updateBookingPoliciesSchema = z.object({
  booking_min_notice_hours: z.number().int().min(0).optional(),
  booking_max_advance_days: z.number().int().min(1).optional(),
  auto_confirm_bookings: z.boolean().optional(),
  cancellation_window_hours: z.number().int().min(0).optional(),
});

const createLeaveSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  reason: z.string().optional(),
});

router.get('/doctors', authGuard, listDoctors);
router.get('/doctors/:doctorId/profile', authGuard, getDoctorProfile);
router.get('/doctor/profile', authGuard, requireRole('doctor'), getOwnDoctorProfile);
router.patch('/doctor/profile', authGuard, requireRole('doctor'), validate(updateDoctorProfileSchema), updateOwnDoctorProfile);
router.post('/venues', authGuard, requireRole('doctor', 'staff'), validate(createVenueSchema), createVenue);
router.get('/venues', authGuard, getVenues);
router.patch('/venues/:id', authGuard, requireRole('doctor', 'staff'), validate(updateVenueSchema), patchVenue);

// Booking policies
router.get('/doctor/booking-policies', authGuard, requireRole('doctor'), getBookingPolicies);
router.patch('/doctor/booking-policies', authGuard, requireRole('doctor'), validate(updateBookingPoliciesSchema), updateBookingPolicies);

// Doctor leaves
router.get('/doctor/leaves', authGuard, requireRole('doctor'), getLeaves);
router.post('/doctor/leaves', authGuard, requireRole('doctor'), validate(createLeaveSchema), createLeave);
router.delete('/doctor/leaves/:id', authGuard, requireRole('doctor'), deleteLeave);

export default router;
