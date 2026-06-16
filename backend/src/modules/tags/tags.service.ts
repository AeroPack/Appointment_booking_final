import { AppError } from '../../utils/response.js';
import type { CreateTagInput, UpdateTagInput } from './tags.types.js';
import { TagsRepository } from './tags.repository.js';

export class TagsService {
  constructor(private readonly repo: TagsRepository) {}

  async createTag(clinicId: string, input: CreateTagInput) {
    try {
      return await this.repo.insertTag({
        clinic_id: clinicId,
        name: input.name,
        color: input.color ?? null,
        is_auto: input.is_auto ?? false,
        rule_definition: input.rule_definition ?? null,
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new AppError(409, 'TAG_EXISTS', `Tag "${input.name}" already exists in this clinic`);
      }
      throw err;
    }
  }

  async listTags(clinicId: string) {
    return this.repo.findTagsByClinic(clinicId);
  }

  async getTag(tagId: string, clinicId: string) {
    const tag = await this.repo.findTagById(tagId, clinicId);
    if (!tag) throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');
    return tag;
  }

  async updateTag(tagId: string, clinicId: string, input: UpdateTagInput) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color;
    if (input.rule_definition !== undefined) data.rule_definition = input.rule_definition;

    try {
      const tag = await this.repo.updateTag(tagId, clinicId, data);
      if (!tag) throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');
      return tag;
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new AppError(409, 'TAG_EXISTS', `Tag name already exists in this clinic`);
      }
      throw err;
    }
  }

  async deleteTag(tagId: string, clinicId: string) {
    const tag = await this.repo.findTagById(tagId, clinicId);
    if (!tag) throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');
    if (tag.is_system) {
      throw new AppError(400, 'SYSTEM_TAG', 'System tags cannot be deleted');
    }
    await this.repo.deleteTag(tagId, clinicId);
  }

  async assignTag(userId: string, tagId: string, assignedBy: string) {
    const exists = await this.repo.findUserTag(userId, tagId);
    if (exists) return;
    await this.repo.assignUserTag(userId, tagId, assignedBy);
  }

  async unassignTag(userId: string, tagId: string) {
    const removed = await this.repo.unassignUserTag(userId, tagId);
    if (!removed) throw new AppError(404, 'TAG_NOT_ASSIGNED', 'Tag is not assigned to this user');
  }

  async listUserTags(userId: string) {
    return this.repo.findUserTags(userId);
  }

  async evaluateAutoTags(patientId: string, clinicId: string) {
    const autoTags = await this.repo.findAutoTagsByClinic(clinicId);
    if (autoTags.length === 0) return;

    const count = await this.repo.countPatientAppointments(patientId);

    for (const tag of autoTags) {
      const rule = tag.rule_definition as Record<string, unknown> | null;
      if (!rule || rule.type !== 'appointment_count') continue;

      const operator = rule.operator as string;
      const value = rule.value as number;
      let matches = false;

      switch (operator) {
        case 'eq':  matches = count === value; break;
        case 'neq': matches = count !== value; break;
        case 'lt':  matches = count < value; break;
        case 'lte': matches = count <= value; break;
        case 'gt':  matches = count > value; break;
        case 'gte': matches = count >= value; break;
      }

      const alreadyAssigned = await this.repo.findUserTag(patientId, tag.id);

      if (matches && !alreadyAssigned) {
        await this.repo.assignUserTag(patientId, tag.id, null);
      } else if (!matches && alreadyAssigned) {
        await this.repo.unassignUserTag(patientId, tag.id);
      }
    }
  }
}
