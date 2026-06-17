import { AppError } from '../../utils/response.js';
import type { UpdateProfileInput, CreateDependentInput } from './users.types.js';
import { UsersRepository } from './users.repository.js';

const FORBIDDEN_FIELDS = ['clinic_id', 'role', 'parent_user_id'];

function parseDateOfBirth(value: string): string {
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return value;
  }
  // MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [m, day, y] = value.split('/');
    const iso = `${y}-${m}-${day}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return iso;
  }
  throw new AppError(400, 'INVALID_DATE', 'date_of_birth must be YYYY-MM-DD or MM/DD/YYYY');
}

export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async getProfile(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const forbidden = FORBIDDEN_FIELDS.filter((f) => f in input);
    if (forbidden.length > 0) {
      throw new AppError(400, 'FORBIDDEN_FIELD', `Cannot update: ${forbidden.join(', ')}`);
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.address !== undefined) data.address = input.address;
    if (input.date_of_birth !== undefined) data.date_of_birth = parseDateOfBirth(input.date_of_birth);
    if (input.city !== undefined) data.city = input.city;
    if (input.state !== undefined) data.state = input.state;
    if (input.zip_code !== undefined) data.zip_code = input.zip_code;

    if (Object.keys(data).length === 0) {
      throw new AppError(400, 'NO_FIELDS', 'No valid fields to update');
    }

    const user = await this.repo.update(userId, data);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    return user;
  }

  async createDependent(callerId: string, clinicId: string, input: CreateDependentInput) {
    const user = await this.repo.create({
      clinic_id: clinicId,
      parent_user_id: callerId,
      name: input.name,
      role: 'patient',
      mobile_number: input.mobile_number,
      whatsapp_number: input.whatsapp_number,
      email: input.email,
      address: input.address,
      relationship: input.relationship,
      date_of_birth: input.date_of_birth ? parseDateOfBirth(input.date_of_birth) : undefined,
    });
    return user;
  }

  async getDependents(userId: string) {
    return this.repo.findDependentsByParentId(userId);
  }

  async updateDependent(callerId: string, dependentId: string, input: Record<string, unknown>) {
    const dependent = await this.repo.findById(dependentId);
    if (!dependent || dependent.parent_user_id !== callerId) {
      throw new AppError(404, 'DEPENDENT_NOT_FOUND', 'Dependent not found');
    }
    const allowed = ['name', 'mobile_number', 'email', 'address', 'relationship', 'date_of_birth'];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (input[key] === undefined) continue;
      data[key] = key === 'date_of_birth'
        ? parseDateOfBirth(input[key] as string)
        : input[key];
    }
    if (Object.keys(data).length === 0) {
      throw new AppError(400, 'NO_FIELDS', 'No valid fields to update');
    }
    const user = await this.repo.update(dependentId, data);
    if (!user) throw new AppError(404, 'DEPENDENT_NOT_FOUND', 'Dependent not found');
    return user;
  }

  async deleteDependent(callerId: string, dependentId: string) {
    const dependent = await this.repo.findById(dependentId);
    if (!dependent || dependent.parent_user_id !== callerId) {
      throw new AppError(404, 'DEPENDENT_NOT_FOUND', 'Dependent not found');
    }
    await this.repo.softDelete(dependentId);
  }

  async searchPatients(clinicId: string, query: string) {
    if (!query || query.length < 2) {
      return [];
    }
    return this.repo.searchPatients(clinicId, query);
  }

  async createPatient(clinicId: string, callerId: string, input: {
    name: string;
    mobile_number?: string;
    email?: string;
    date_of_birth?: string;
    address?: string;
  }) {
    const existing = await this.repo.searchPatients(clinicId, input.mobile_number || '');
    if (input.mobile_number && existing.length > 0) {
      throw new AppError(409, 'PATIENT_EXISTS', 'A patient with this mobile number already exists');
    }
    return this.repo.create({
      clinic_id: clinicId,
      parent_user_id: null,
      name: input.name,
      role: 'patient',
      mobile_number: input.mobile_number || null,
      email: input.email || null,
      date_of_birth: input.date_of_birth ? parseDateOfBirth(input.date_of_birth) : null,
      address: input.address || null,
    });
  }
}
