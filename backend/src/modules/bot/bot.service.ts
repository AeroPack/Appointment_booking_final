import { generateSlotsForPeriod, combineDateAndTime } from '../../utils/slotGenerator.js';
import { AppError } from '../../utils/response.js';
import { BotRepository } from './bot.repository.js';
import type { BotSlotsQuery, BotBookBody, BotFaqQuery, BotLookupQuery } from './bot.types.js';
import axios from 'axios';

const MAX_RANGE_DAYS = 14;

export class BotService {
  constructor(private readonly repo: BotRepository) {}

  async getSlots(query: BotSlotsQuery) {
    const doctorExists = await this.repo.findDoctorExists(query.doctor_id);
    if (!doctorExists) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found');

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
      throw new AppError(400, 'RANGE_TOO_LARGE', 'Date range must not exceed 14 days');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: { date: string; slots: Array<{
      start: string; end: string; capacity: number;
      booked_count: number; available: number; is_full: boolean;
      venue: { id: string; name: string } | null;
    }> }[] = [];

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

      const daySlots = allSlotTimes
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

  async bookAppointment(body: BotBookBody) {
    const doctorExists = await this.repo.findDoctorExists(body.doctor_id);
    if (!doctorExists) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found');

    const clinicId = await this.repo.findClinicForDoctor(body.doctor_id);
    if (!clinicId) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not associated with any clinic');

    const scheduledStart = new Date(body.slot_start);
    if (isNaN(scheduledStart.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'Invalid slot_start');
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

    const idempotencyKey = `widget:${body.patient_phone}:${body.slot_start}`;
    const existing = await this.repo.findIdempotencyKey(idempotencyKey);
    if (existing) {
      const appt = await this.repo.findAppointmentById(existing.appointment_id);
      if (appt) {
        return {
          appointment_id: appt.id,
          token_number: appt.token_number,
          doctor_name: appt.doctor_name,
          scheduled_start: new Date(appt.scheduled_start).toISOString(),
          scheduled_end: new Date(appt.scheduled_end).toISOString(),
          venue: appt.venue_id ? { id: appt.venue_id, name: appt.venue_name || 'Unknown' } : null,
          patient_name: appt.patient_name,
        };
      }
    }

    let patient = await this.repo.findPatientByPhone(body.patient_phone);
    if (!patient) {
      patient = await this.repo.createPatient({
        name: body.patient_name,
        phone: body.patient_phone,
        clinicId,
      });
    }

    const dateStr = formatDate(scheduledStart);
    const tokenNumber = await this.repo.getNextTokenNumber(body.doctor_id, dateStr);

    const appointment = await this.repo.insertAppointment({
      clinic_id: clinicId,
      doctor_id: body.doctor_id,
      patient_id: patient.id,
      booked_by_user_id: body.doctor_id,
      venue_id: matching.venue_id,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      token_number: tokenNumber,
      notes: body.reason,
    });

    await this.repo.insertIdempotencyKey(idempotencyKey, appointment.id);

    const doctorInfo = await this.repo.findDoctorInfo(body.doctor_id);

    return {
      appointment_id: appointment.id,
      token_number: tokenNumber,
      doctor_name: doctorInfo?.name || 'Doctor',
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      venue: matching.venue_id ? { id: matching.venue_id, name: matching.venue_name || 'Unknown' } : null,
      patient_name: body.patient_name,
    };
  }

  async getDoctorInfo(doctorId: string) {
    const info = await this.repo.findDoctorInfo(doctorId);
    if (!info) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found');
    return info;
  }

  async searchFaq(query: BotFaqQuery) {
    const doctorExists = await this.repo.findDoctorExists(query.doctor_id);
    if (!doctorExists) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found');

    const faqEntries = await this.repo.findFaqByDoctor(query.doctor_id);
    if (faqEntries.length === 0) {
      return { answer: null, matched: false };
    }

    const normalizedQuery = query.query.toLowerCase().trim();
    let bestMatch: { question: string; answer: string; score: number } | null = null;

    for (const entry of faqEntries) {
      const normalizedQuestion = entry.question.toLowerCase();
      const normalizedAnswer = entry.answer.toLowerCase();

      let score = 0;
      const queryWords = normalizedQuery.split(/\s+/);

      for (const word of queryWords) {
        if (word.length < 3) continue;
        if (normalizedQuestion.includes(word)) score += 2;
        if (normalizedAnswer.includes(word)) score += 1;
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { question: entry.question, answer: entry.answer, score };
      }
    }

    if (bestMatch && bestMatch.score >= 2) {
      return { answer: bestMatch.answer, matched: true };
    }

    return { answer: null, matched: false };
  }

  async lookupPatient(query: BotLookupQuery) {
    const doctorExists = await this.repo.findDoctorExists(query.doctor_id);
    if (!doctorExists) throw new AppError(404, 'DOCTOR_NOT_FOUND', 'Doctor not found');

    const patient = await this.repo.findPatientByPhone(query.phone);
    if (!patient) {
      return { found: false };
    }

    const pastAppointments = await this.repo.findPastAppointmentCount(patient.id, query.doctor_id);

    return {
      found: true,
      patient_id: patient.id,
      name: patient.name,
      past_appointments: pastAppointments,
    };
  }

  async getConfig(doctorId: string) {
    return this.repo.getOrCreateChatbotConfig(doctorId);
  }

  async updateConfig(doctorId: string, data: {
    is_enabled?: boolean;
    primary_color?: string;
    greeting_msg?: string;
    position?: string;
  }) {
    await this.repo.upsertChatbotConfig(doctorId, data);
    return this.getConfig(doctorId);
  }

  async listFaq(doctorId: string) {
    return this.repo.listFaqByDoctor(doctorId);
  }

  async createFaq(doctorId: string, data: { question: string; answer: string; keywords?: string[] }) {
    return this.repo.createFaqEntry(doctorId, data);
  }

  async updateFaq(id: string, doctorId: string, data: { question?: string; answer?: string; keywords?: string[] }) {
    const updated = await this.repo.updateFaqEntry(id, doctorId, data);
    if (!updated) throw new AppError(404, 'FAQ_NOT_FOUND', 'FAQ entry not found');
  }

  async deleteFaq(id: string, doctorId: string) {
    const deleted = await this.repo.deleteFaqEntry(id, doctorId);
    if (!deleted) throw new AppError(404, 'FAQ_NOT_FOUND', 'FAQ entry not found');
  }

  async extractField(text: string, fieldType: string): Promise<string> {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) return text;

    const fieldPrompts: Record<string, string> = {
      name: 'Extract the person\'s actual name. Remove phrases like "my name is", "i am", "i\'m", "this is", "call me", "hello i am", etc. Return only the clean name.',
      phone: 'Extract the phone number. Return only digits, no spaces, dashes, or country codes. If no phone number found, return the original text.',
      reason: 'Extract the medical reason or condition for the visit. Keep it concise and clinical. Remove filler phrases.',
      faq: 'Extract the core question the user is asking. Rephrase as a clear, short question.',
    };

    const prompt = fieldPrompts[fieldType] || `Extract the ${fieldType} from this message.`;

    try {
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          contents: [{ parts: [{ text: `${prompt}\n\nUser message: "${text}"` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                extracted_value: { type: 'STRING', nullable: true },
              },
              required: ['extracted_value'],
            },
          },
        },
        {
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          timeout: 3000,
        }
      );

      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) return text;

      const parsed = JSON.parse(content);
      return parsed.extracted_value || text;
    } catch {
      return text;
    }
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
