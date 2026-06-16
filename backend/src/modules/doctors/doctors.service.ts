import { AppError } from '../../utils/response.js';
import type { CreateVenueInput, UpdateVenueInput, UpdateDoctorProfileInput } from './doctors.types.js';
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
}
