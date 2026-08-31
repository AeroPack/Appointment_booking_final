import { AppError } from '../../utils/response.js';
import type { CreateCustomStatusInput, UpdateCustomStatusInput } from './custom-statuses.types.js';
import { CustomStatusesRepository } from './custom-statuses.repository.js';

export class CustomStatusesService {
  constructor(private readonly repo: CustomStatusesRepository) {}

  async createStatus(clinicId: string, input: CreateCustomStatusInput) {
    try {
      return await this.repo.insert({
        clinic_id: clinicId,
        name: input.name,
        color: input.color ?? null,
        sort_order: input.sort_order ?? 0,
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new AppError(409, 'STATUS_EXISTS', `Status "${input.name}" already exists in this clinic`);
      }
      throw err;
    }
  }

  async listStatuses(clinicId: string) {
    return this.repo.findByClinic(clinicId);
  }

  async getStatus(statusId: string, clinicId: string) {
    const status = await this.repo.findById(statusId, clinicId);
    if (!status) throw new AppError(404, 'STATUS_NOT_FOUND', 'Status not found');
    return status;
  }

  async updateStatus(statusId: string, clinicId: string, input: UpdateCustomStatusInput) {
    const existing = await this.repo.findById(statusId, clinicId);
    if (!existing) throw new AppError(404, 'STATUS_NOT_FOUND', 'Status not found');

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color;
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;

    try {
      const updated = await this.repo.update(statusId, clinicId, data);
      if (!updated) throw new AppError(404, 'STATUS_NOT_FOUND', 'Status not found');
      return updated;
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new AppError(409, 'STATUS_EXISTS', 'Status name already exists in this clinic');
      }
      throw err;
    }
  }

  async deleteStatus(statusId: string, clinicId: string) {
    const status = await this.repo.findById(statusId, clinicId);
    if (!status) throw new AppError(404, 'STATUS_NOT_FOUND', 'Status not found');
    if (status.is_system) {
      throw new AppError(400, 'SYSTEM_STATUS', 'System statuses cannot be deleted');
    }
    await this.repo.delete(statusId, clinicId);
  }
}
