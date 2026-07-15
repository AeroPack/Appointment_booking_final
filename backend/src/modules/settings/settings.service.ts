import { AppError } from '../../utils/response.js';
import type { PutSettingsInput, CreateTemplateInput, UpdateTemplateInput, UpdateUserSettingsInput } from './settings.types.js';
import { SettingsRepository } from './settings.repository.js';

export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  async validateDoctorClinic(doctorId: string, clinicId: string): Promise<boolean> {
    const { default: pool } = await import('../../config/db.js');
    const result = await pool.query(
      'SELECT 1 FROM users WHERE id = $1 AND clinic_id = $2 AND role = $3 AND deleted_at IS NULL',
      [doctorId, clinicId, 'doctor']
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getSettings(doctorId: string, clinicId: string) {
    const belongs = await this.validateDoctorClinic(doctorId, clinicId);
    if (!belongs) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found in this clinic');

    const periods = await this.repo.findSettingsByDoctor(doctorId, clinicId);

    const periodsWithVenue = await Promise.all(
      periods.map(async (p) => ({
        day_of_week: p.day_of_week,
        start_time: p.start_time.slice(0, 5),
        end_time: p.end_time.slice(0, 5),
        slot_duration_minutes: p.slot_duration_minutes,
        max_patients_per_slot: p.max_patients_per_slot,
        venue: p.venue_id
          ? { id: p.venue_id, name: (await this.repo.findVenueName(p.venue_id)) ?? 'Unknown' }
          : null,
      }))
    );

    const reminders = await this.repo.findTemplatesByDoctor(clinicId, doctorId);

    return {
      doctor_id: doctorId,
      periods: periodsWithVenue,
      reminders: reminders.map((r) => ({
        id: r.id,
        template_type: r.template_type,
        offset_minutes: r.offset_minutes,
        subject: r.subject,
        content: r.content,
        channel: r.channel,
      })),
    };
  }

  async putSettings(clinicId: string, input: PutSettingsInput) {
    const belongs = await this.validateDoctorClinic(input.doctor_id, clinicId);
    if (!belongs) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found in this clinic');

    await this.repo.deleteSettingsByDoctor(input.doctor_id);
    for (const p of input.periods) {
      await this.repo.insertSetting({
        doctor_id: input.doctor_id,
        venue_id: p.venue_id || null,
        day_of_week: p.day_of_week,
        start_time: p.start_time,
        end_time: p.end_time,
        slot_duration_minutes: p.slot_duration_minutes,
        max_patients_per_slot: p.max_patients_per_slot,
      });
    }

    await this.repo.deleteTemplatesByDoctor(clinicId, input.doctor_id);
    for (const r of input.reminders) {
      await this.repo.insertTemplate({
        clinic_id: clinicId,
        doctor_id: input.doctor_id,
        template_type: r.template_type,
        subject: r.subject,
        content: r.content,
        offset_minutes: r.offset_minutes ?? null,
        channel: r.channel || 'whatsapp',
      });
    }

    return this.getSettings(input.doctor_id, clinicId);
  }

  async createTemplate(clinicId: string, input: CreateTemplateInput) {
    if (input.template_type === 'reminder' && (input.offset_minutes == null || input.offset_minutes <= 0)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Reminder templates require offset_minutes > 0');
    }
    if (input.template_type !== 'reminder' && input.offset_minutes != null) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Event templates must not have offset_minutes');
    }

    return this.repo.insertTemplate({
      clinic_id: clinicId,
      doctor_id: input.doctor_id || null,
      template_type: input.template_type,
      subject: input.subject,
      content: input.content,
      offset_minutes: input.offset_minutes ?? null,
      channel: input.channel || 'whatsapp',
    });
  }

  async listTemplates(clinicId: string, doctorId?: string) {
    return this.repo.findTemplatesByDoctor(clinicId, doctorId);
  }

  async updateTemplate(templateId: string, clinicId: string, input: UpdateTemplateInput) {
    const existing = await this.repo.findTemplateById(templateId, clinicId);
    if (!existing) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');

    const newType = input.template_type ?? existing.template_type;
    const newOffset = input.offset_minutes !== undefined ? input.offset_minutes : existing.offset_minutes;

    if (newType === 'reminder' && (newOffset == null || newOffset <= 0)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Reminder templates require offset_minutes > 0');
    }
    if (newType !== 'reminder' && newOffset != null) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Event templates must not have offset_minutes');
    }

    const data: Record<string, unknown> = {};
    if (input.template_type !== undefined) data.template_type = input.template_type;
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.content !== undefined) data.content = input.content;
    if (input.offset_minutes !== undefined) data.offset_minutes = input.offset_minutes;
    if (input.channel !== undefined) data.channel = input.channel;
    if (input.is_active !== undefined) data.is_active = input.is_active;

    const updated = await this.repo.updateTemplate(templateId, clinicId, data);
    if (!updated) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
    return updated;
  }

  async deleteTemplate(templateId: string, clinicId: string) {
    const deleted = await this.repo.deleteTemplate(templateId, clinicId);
    if (!deleted) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
  }

  async getUserSettings(userId: string) {
    const settings = await this.repo.findUserSettings(userId);
    if (!settings) {
      return this.repo.upsertUserSettings(userId, {});
    }
    return settings;
  }

  async updateUserSettings(userId: string, input: UpdateUserSettingsInput) {
    const data: Record<string, unknown> = {};
    if (input.notifications_enabled !== undefined) data.notifications_enabled = input.notifications_enabled;
    if (input.language !== undefined) data.language = input.language;
    return this.repo.upsertUserSettings(userId, data);
  }
}
