import { generateSlotsForPeriod, combineDateAndTime } from '../../utils/slotGenerator.js';
import { AppError } from '../../utils/response.js';
import type { FindSlotsQuery, DaySlots, SlotResponse, BookSlotBody, BookingResponse } from './appointments.types.js';
import { AppointmentsRepository } from './appointments.repository.js';

const MAX_RANGE_DAYS = 31;

export class AppointmentsService {
  constructor(private readonly repo: AppointmentsRepository) {}

  async bookSlot(clinicId: string, userId: string, body: BookSlotBody): Promise<BookingResponse> {
    const idempotent = await this.repo.findIdempotency(body.idempotency_key);
    if (idempotent) {
      const existing = await this.repo.findAppointmentById(idempotent.appointment_id);
      if (existing) return this.toBookingResponse(existing);
    }

    const doctorBelongs = await this.checkDoctorClinic(body.doctor_id, clinicId);
    if (!doctorBelongs) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found in this clinic');

    const scheduledStart = new Date(body.scheduled_start);
    if (isNaN(scheduledStart.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'Invalid scheduled_start');
    }

    if (scheduledStart <= new Date()) {
      throw new AppError(400, 'PAST_SLOT', 'Cannot book a slot in the past');
    }

    const ist = toIST(scheduledStart);
    const slotMin = ist.hours * 60 + ist.minutes;

    const periods = await this.repo.findSettingsByDoctorAndDay(body.doctor_id, ist.dayOfWeek);
    if (periods.length === 0) {
      throw new AppError(400, 'NO_SETTING_FOR_DAY', 'Doctor has no active settings for this day');
    }

    const matching = periods.find((p) => {
      const start = toMinutes(p.start_time);
      const end = toMinutes(p.end_time);
      return slotMin >= start && (slotMin + p.slot_duration_minutes) <= end;
    });
    if (!matching) {
      throw new AppError(400, 'INVALID_SLOT', 'The requested time does not fall within an active period');
    }

    const periodStart = toMinutes(matching.start_time);
    if ((slotMin - periodStart) % matching.slot_duration_minutes !== 0) {
      throw new AppError(400, 'INVALID_SLOT_ALIGNMENT', 'Slot time must align with the slot grid');
    }

    const scheduledEnd = new Date(scheduledStart.getTime() + matching.slot_duration_minutes * 60 * 1000);

    const bookedCount = await this.repo.findBookedCountForSlot(body.doctor_id, scheduledStart, scheduledEnd);
    if (bookedCount >= matching.max_patients_per_slot) {
      throw new AppError(409, 'SLOT_FULL', 'This slot is fully booked');
    }

    const patientId = body.patient_id || userId;
    const dateStr = formatDate(scheduledStart);
    const tokenNumber = await this.repo.getNextTokenNumber(body.doctor_id, dateStr);

    const appointment = await this.repo.insertAppointment({
      clinic_id: clinicId,
      doctor_id: body.doctor_id,
      patient_id: patientId,
      booked_by_user_id: userId,
      venue_id: matching.venue_id,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      token_number: tokenNumber,
      appointment_type: body.appointment_type ?? 'checkup',
    });

    await this.repo.saveIdempotency(body.idempotency_key, appointment.id);

    const created = await this.repo.findAppointmentById(appointment.id);
    return this.toBookingResponse(created!);
  }

  async findSlots(clinicId: string, query: FindSlotsQuery) {
    const doctorBelongs = await this.checkDoctorClinic(query.doctor_id, clinicId);
    if (!doctorBelongs) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found in this clinic');

    const from = new Date(query.from + 'T00:00:00');
    const to = query.to ? new Date(query.to + 'T00:00:00') : from;

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'Invalid date format. Use YYYY-MM-DD.');
    }

    if (from > to) {
      throw new AppError(400, 'INVALID_RANGE', '"from" must be before or equal to "to"');
    }

    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > MAX_RANGE_DAYS) {
      throw new AppError(400, 'RANGE_TOO_LARGE', 'Date range must not exceed 31 days');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: DaySlots[] = [];
    let slotDuration = 15;
    let maxPatients = 10;

    for (let i = 0; i < diffDays; i++) {
      const currentDate = new Date(from);
      currentDate.setDate(from.getDate() + i);
      const dateStr = formatDate(currentDate);

      if (currentDate < today) {
        days.push({ date: dateStr, slots: [] });
        continue;
      }

      const dayOfWeek = ((currentDate.getDay() + 6) % 7) + 1;

      const periods = await this.repo.findSettingsByDoctorAndDay(query.doctor_id, dayOfWeek);

      if (periods.length === 0) {
        days.push({ date: dateStr, slots: [] });
        continue;
      }

      slotDuration = periods[0].slot_duration_minutes;
      maxPatients = periods[0].max_patients_per_slot;

      const allSlotTimes: { start: string; end: string; venue: { id: string; name: string } | null }[] = [];

      for (const period of periods) {
        const slots = generateSlotsForPeriod(period.start_time, period.end_time, period.slot_duration_minutes);
        const venue = period.venue_id
          ? { id: period.venue_id, name: period.venue_name || 'Unknown' }
          : null;
        for (const s of slots) {
          allSlotTimes.push({ start: s.start, end: s.end, venue });
        }
      }

      allSlotTimes.sort((a, b) => a.start.localeCompare(b.start));

      const bookedCounts = await this.repo.findBookedCounts(query.doctor_id, dateStr);
      const bookedMap = new Map<string, number>();
      for (const b of bookedCounts) {
        bookedMap.set(b.slot_time.slice(0, 5), b.count);
      }

      const daySlots: SlotResponse[] = allSlotTimes
        .filter((s) => {
          if (currentDate > today) return true;
          const slotDateTime = new Date(combineDateAndTime(dateStr, s.start));
          return slotDateTime > new Date();
        })
        .map((s) => {
          const booked = bookedMap.get(s.start) || 0;
          const available = Math.max(0, maxPatients - booked);
          return {
            start: combineDateAndTime(dateStr, s.start),
            end: combineDateAndTime(dateStr, s.end),
            capacity: maxPatients,
            booked_count: booked,
            available,
            is_full: booked >= maxPatients,
            venue: s.venue,
          };
        });

      days.push({ date: dateStr, slots: daySlots });
    }

    return {
      doctor_setting: { slot_duration_minutes: slotDuration, max_patients_per_slot: maxPatients },
      days,
    };
  }

  private toBookingResponse(row: {
    id: string;
    doctor_id: string;
    patient_id: string;
    scheduled_start: Date;
    scheduled_end: Date;
    token_number: number | null;
    appointment_status: string;
    appointment_type: string;
    venue_id: string | null;
    venue_name: string | null;
  }): BookingResponse {
    return {
      id: row.id,
      doctor_id: row.doctor_id,
      patient_id: row.patient_id,
      scheduled_start: row.scheduled_start.toISOString(),
      scheduled_end: row.scheduled_end.toISOString(),
      token_number: row.token_number,
      appointment_status: row.appointment_status,
      appointment_type: row.appointment_type,
      venue: row.venue_id ? { id: row.venue_id, name: row.venue_name || 'Unknown' } : null,
    };
  }

  async bookOnBehalf(clinicId: string, bookedByUserId: string, body: {
    doctor_id: string;
    patient_id: string;
    scheduled_start: string;
    idempotency_key: string;
    appointment_type?: string;
  }): Promise<BookingResponse> {
    const idempotent = await this.repo.findIdempotency(body.idempotency_key);
    if (idempotent) {
      const existing = await this.repo.findAppointmentById(idempotent.appointment_id);
      if (existing) return this.toBookingResponse(existing);
    }

    const doctorBelongs = await this.checkDoctorClinic(body.doctor_id, clinicId);
    if (!doctorBelongs) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found in this clinic');

    const scheduledStart = new Date(body.scheduled_start);
    if (isNaN(scheduledStart.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'Invalid scheduled_start');
    }

    const ist = toIST(scheduledStart);
    const slotMin = ist.hours * 60 + ist.minutes;

    const periods = await this.repo.findSettingsByDoctorAndDay(body.doctor_id, ist.dayOfWeek);
    if (periods.length === 0) {
      throw new AppError(400, 'NO_SETTING_FOR_DAY', 'Doctor has no active settings for this day');
    }

    const matching = periods.find((p) => {
      const start = toMinutes(p.start_time);
      const end = toMinutes(p.end_time);
      return slotMin >= start && (slotMin + p.slot_duration_minutes) <= end;
    });
    if (!matching) {
      throw new AppError(400, 'INVALID_SLOT', 'The requested time does not fall within an active period');
    }

    const periodStart = toMinutes(matching.start_time);
    if ((slotMin - periodStart) % matching.slot_duration_minutes !== 0) {
      throw new AppError(400, 'INVALID_SLOT_ALIGNMENT', 'Slot time must align with the slot grid');
    }

    const scheduledEnd = new Date(scheduledStart.getTime() + matching.slot_duration_minutes * 60 * 1000);

    const bookedCount = await this.repo.findBookedCountForSlot(body.doctor_id, scheduledStart, scheduledEnd);
    if (bookedCount >= matching.max_patients_per_slot) {
      throw new AppError(409, 'SLOT_FULL', 'This slot is fully booked');
    }

    const dateStr = formatDate(scheduledStart);
    const tokenNumber = await this.repo.getNextTokenNumber(body.doctor_id, dateStr);

    const appointment = await this.repo.insertAppointment({
      clinic_id: clinicId,
      doctor_id: body.doctor_id,
      patient_id: body.patient_id,
      booked_by_user_id: bookedByUserId,
      venue_id: matching.venue_id,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      token_number: tokenNumber,
      appointment_type: body.appointment_type ?? 'checkup',
    });

    await this.repo.saveIdempotency(body.idempotency_key, appointment.id);

    const created = await this.repo.findAppointmentById(appointment.id);
    return this.toBookingResponse(created!);
  }

  async rescheduleAppointment(clinicId: string, userId: string, appointmentId: string, body: {
    patient_id: string;
    scheduled_start: string;
    idempotency_key: string;
    appointment_type?: string;
  }): Promise<BookingResponse> {
    const existing = await this.repo.findAppointmentById(appointmentId);
    if (!existing) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found');

    if (existing.appointment_status !== 'booked') {
      throw new AppError(400, 'INVALID_STATUS', 'Only booked appointments can be rescheduled');
    }

    const doctorBelongs = await this.checkDoctorClinic(existing.doctor_id, clinicId);
    if (!doctorBelongs) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found in this clinic');

    const scheduledStart = new Date(body.scheduled_start);
    if (isNaN(scheduledStart.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'Invalid scheduled_start');
    }

    const ist = toIST(scheduledStart);
    const slotMin = ist.hours * 60 + ist.minutes;

    const periods = await this.repo.findSettingsByDoctorAndDay(existing.doctor_id, ist.dayOfWeek);
    if (periods.length === 0) {
      throw new AppError(400, 'NO_SETTING_FOR_DAY', 'Doctor has no active settings for this day');
    }

    const matching = periods.find((p) => {
      const start = toMinutes(p.start_time);
      const end = toMinutes(p.end_time);
      return slotMin >= start && (slotMin + p.slot_duration_minutes) <= end;
    });
    if (!matching) {
      throw new AppError(400, 'INVALID_SLOT', 'The requested time does not fall within an active period');
    }

    const periodStart = toMinutes(matching.start_time);
    if ((slotMin - periodStart) % matching.slot_duration_minutes !== 0) {
      throw new AppError(400, 'INVALID_SLOT_ALIGNMENT', 'Slot time must align with the slot grid');
    }

    const scheduledEnd = new Date(scheduledStart.getTime() + matching.slot_duration_minutes * 60 * 1000);

    const bookedCount = await this.repo.findBookedCountForSlot(existing.doctor_id, scheduledStart, scheduledEnd);
    if (bookedCount >= matching.max_patients_per_slot) {
      throw new AppError(409, 'SLOT_FULL', 'This slot is fully booked');
    }

    await this.repo.updateAppointment(appointmentId, {
      patient_id: body.patient_id,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      venue_id: matching.venue_id,
      appointment_type: body.appointment_type,
    });

    const updated = await this.repo.findAppointmentById(appointmentId);
    return this.toBookingResponse(updated!);
  }

  async listAppointments(userId: string, status?: string) {
    return this.repo.findAppointmentsByUser(userId, status);
  }

  async getAppointmentDetail(appointmentId: string, userId: string) {
    const appointment = await this.repo.findAppointmentById(appointmentId);
    if (!appointment) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found');

    const isAuthorized =
      appointment.patient_id === userId ||
      appointment.doctor_id === userId;
    if (!isAuthorized) throw new AppError(403, 'FORBIDDEN', 'Not authorized to view this appointment');

    const statusHistory = await this.repo.findStatusHistory(appointmentId);
    return { ...appointment, statusHistory };
  }

  async cancelAppointment(appointmentId: string, userId: string) {
    const appointment = await this.repo.findAppointmentById(appointmentId);
    if (!appointment) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found');

    if (appointment.patient_id !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the patient can cancel their appointment');
    }

    if (appointment.appointment_status !== 'booked') {
      throw new AppError(400, 'INVALID_STATUS', 'Only booked appointments can be cancelled');
    }

    const oldStatus = appointment.appointment_status;
    await this.repo.updateAppointmentStatus(appointmentId, 'cancelled');
    await this.repo.insertStatusHistory({
      appointment_id: appointmentId,
      old_status: oldStatus,
      new_status: 'cancelled',
      changed_by: userId,
    });

    const { default: pool } = await import('../../config/db.js');
    await pool.query(
      `DELETE FROM messages WHERE appointment_id = $1 AND status = 'pending'`,
      [appointmentId]
    );

    return { message: 'Appointment cancelled' };
  }

  async updateStatus(appointmentId: string, userId: string, newStatus: string) {
    const validTransitions: Record<string, string[]> = {
      booked: ['finished', 'no_show'],
    };

    const appointment = await this.repo.findAppointmentById(appointmentId);
    if (!appointment) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found');

    const allowed = validTransitions[appointment.appointment_status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new AppError(400, 'INVALID_TRANSITION', `Cannot change status from '${appointment.appointment_status}' to '${newStatus}'`);
    }

    const oldStatus = appointment.appointment_status;
    await this.repo.updateAppointmentStatus(appointmentId, newStatus);
    await this.repo.insertStatusHistory({
      appointment_id: appointmentId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: userId,
    });

    return { message: `Appointment status updated to '${newStatus}'` };
  }

  private async checkDoctorClinic(doctorId: string, clinicId: string): Promise<boolean> {
    const { default: pool } = await import('../../config/db.js');
    const result = await pool.query(
      'SELECT 1 FROM users WHERE id = $1 AND clinic_id = $2 AND role = $3 AND deleted_at IS NULL',
      [doctorId, clinicId, 'doctor']
    );
    return (result.rowCount ?? 0) > 0;
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toIST(date: Date): { hours: number; minutes: number; dayOfWeek: number } {
  const offset = 5.5 * 60 * 60 * 1000;
  const d = new Date(date.getTime() + offset);
  const dayOfWeek = ((d.getUTCDay() + 6) % 7) + 1;
  return { hours: d.getUTCHours(), minutes: d.getUTCMinutes(), dayOfWeek };
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
