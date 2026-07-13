import { AppError } from '../../utils/response.js';
import type { CreateVenueInput, UpdateVenueInput, UpdateDoctorProfileInput, UpdateBookingPoliciesInput, CreateLeaveInput, UpdateWhatsAppConfigInput } from './doctors.types.js';
import { DoctorsRepository } from './doctors.repository.js';

export class DoctorsService {
  constructor(private readonly repo: DoctorsRepository) {}

  async getDoctorProfile(doctorId: string, clinicId: string) {
    const profile = await this.repo.findDoctorProfile(doctorId, clinicId);
    if (!profile) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found');
    const venues = await this.repo.findDoctorVenues(doctorId);
    return { ...profile, venues };
  }

  async listDoctors(clinicId: string, speciality?: string) {
    return this.repo.findAllDoctors(clinicId, speciality);
  }

  async getOwnDoctorProfile(userId: string, clinicId: string) {
    const profile = await this.repo.findOwnDoctorProfile(userId, clinicId);
    if (!profile) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor profile not found');
    return profile;
  }

  async updateOwnDoctorProfile(userId: string, clinicId: string, input: UpdateDoctorProfileInput) {
    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.speciality !== undefined) data.speciality = input.speciality;
    if (input.qualification !== undefined) data.qualification = input.qualification;
    if (input.registration_number !== undefined) data.registration_number = input.registration_number;
    if (input.bio !== undefined) data.bio = input.bio;
    if (input.consultation_fee !== undefined) data.consultation_fee = input.consultation_fee;
    if (input.experience_years !== undefined) data.experience_years = input.experience_years;

    if (Object.keys(data).length === 0) {
      throw new AppError(400, 'NO_FIELDS', 'No valid fields to update');
    }

    await this.repo.upsertDoctorProfile(userId, data);
    return this.getOwnDoctorProfile(userId, clinicId);
  }

  async createVenue(clinicId: string, input: CreateVenueInput) {
    return this.repo.createVenue(clinicId, input);
  }

  async getVenues(clinicId: string) {
    return this.repo.findVenuesByClinic(clinicId);
  }

  async getVenue(venueId: string, clinicId: string) {
    const venue = await this.repo.findVenueById(venueId, clinicId);
    if (!venue) throw new AppError(404, 'VENUE_NOT_FOUND', 'Venue not found');
    return venue;
  }

  async updateVenue(venueId: string, clinicId: string, input: UpdateVenueInput) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.address !== undefined) data.address = input.address;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.is_active !== undefined) data.is_active = input.is_active;

    const venue = await this.repo.updateVenue(venueId, clinicId, data);
    if (!venue) throw new AppError(404, 'VENUE_NOT_FOUND', 'Venue not found');
    return venue;
  }

  // ─── Booking Policies ───────────────────────────────────────────────────────

  async getBookingPolicies(userId: string) {
    const policies = await this.repo.getBookingPolicies(userId);
    if (!policies) {
      // Return defaults if doctor_profile row doesn't exist yet
      return {
        booking_min_notice_hours: 2,
        booking_max_advance_days: 30,
        auto_confirm_bookings: true,
        cancellation_window_hours: 24,
      };
    }
    return policies;
  }

  async updateBookingPolicies(userId: string, input: UpdateBookingPoliciesInput) {
    const data: Record<string, unknown> = {};
    if (input.booking_min_notice_hours !== undefined) data.booking_min_notice_hours = input.booking_min_notice_hours;
    if (input.booking_max_advance_days !== undefined) data.booking_max_advance_days = input.booking_max_advance_days;
    if (input.auto_confirm_bookings !== undefined) data.auto_confirm_bookings = input.auto_confirm_bookings;
    if (input.cancellation_window_hours !== undefined) data.cancellation_window_hours = input.cancellation_window_hours;

    if (Object.keys(data).length === 0) {
      throw new AppError(400, 'NO_FIELDS', 'No valid fields to update');
    }

    await this.repo.updateBookingPolicies(userId, data);
    return this.getBookingPolicies(userId);
  }

  // ─── Doctor Leaves ──────────────────────────────────────────────────────────

  async getLeaves(doctorId: string) {
    return this.repo.findLeaves(doctorId);
  }

  async createLeave(doctorId: string, input: CreateLeaveInput) {
    return this.repo.createLeave(doctorId, {
      start_date: input.start_date,
      end_date: input.end_date,
      reason: input.reason,
    });
  }

  async deleteLeave(leaveId: string, doctorId: string) {
    const deleted = await this.repo.deleteLeave(leaveId, doctorId);
    if (!deleted) throw new AppError(404, 'LEAVE_NOT_FOUND', 'Leave entry not found');
  }

  // ─── WhatsApp Configuration ──────────────────────────────────────────────────

  async getWhatsAppConfig(clinicId: string) {
    const config = await this.repo.getWhatsAppConfig(clinicId);
    if (!config) {
      // Return defaults if clinic doesn't have configuration
      return {
        ultramsg_instance_id: null,
        ultramsg_token: null,
        whatsapp_number: null,
        whatsapp_enabled: false,
      };
    }
    return config;
  }

  async updateWhatsAppConfig(clinicId: string, input: UpdateWhatsAppConfigInput) {
    const data: Record<string, unknown> = {};
    if (input.ultramsg_instance_id !== undefined) data.ultramsg_instance_id = input.ultramsg_instance_id;
    if (input.ultramsg_token !== undefined) data.ultramsg_token = input.ultramsg_token;
    if (input.whatsapp_number !== undefined) data.whatsapp_number = input.whatsapp_number;
    if (input.whatsapp_enabled !== undefined) data.whatsapp_enabled = input.whatsapp_enabled;

    if (Object.keys(data).length === 0) {
      throw new AppError(400, 'NO_FIELDS', 'No valid fields to update');
    }

    return this.repo.updateWhatsAppConfig(clinicId, data);
  }
}
