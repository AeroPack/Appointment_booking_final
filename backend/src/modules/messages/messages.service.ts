import { AppError } from '../../utils/response.js';
import { MessagesRepository } from './messages.repository.js';
import { channelRegistry } from '../../utils/channels/index.js';
import type { ChannelType } from '../../utils/channels/types.js';

const MAX_RETRIES = 3;

export class MessagesService {
  constructor(private readonly repo: MessagesRepository) {}

  async sendMessage(
    clinicId: string,
    senderId: string,
    body: { template_id: string; receiver_id: string; appointment_id?: string; schedule_for?: string }
  ): Promise<void> {
    const template = await this.repo.findTemplateById(body.template_id);
    if (!template) {
      throw new AppError(400, 'TEMPLATE_NOT_FOUND', 'Message template not found');
    }

    let appointmentData: Awaited<ReturnType<typeof this.repo.findAppointmentForRender>> = null;
    if (body.appointment_id) {
      appointmentData = await this.repo.findAppointmentForRender(body.appointment_id);
    }

    const placeholderData: Record<string, string> = {};
    if (appointmentData) {
      placeholderData.patient_name = appointmentData.patient_name;
      placeholderData.doctor_name = appointmentData.doctor_name;
      placeholderData.slot_time = formatSlotTime(appointmentData.scheduled_start);
      placeholderData.venue = appointmentData.venue_name || 'Unknown';
      placeholderData.clinic_name = appointmentData.clinic_name;
      placeholderData.token_number = appointmentData.token_number != null ? String(appointmentData.token_number) : '';
    }

    const rendered = renderTemplate(template.content, placeholderData);
    const subject = template.subject ? renderTemplate(template.subject, placeholderData) : null;

    const scheduleFor = body.schedule_for ? new Date(body.schedule_for) : new Date();

    await this.repo.insertMessage({
      appointment_id: body.appointment_id || null,
      template_id: template.id,
      sender_id: senderId,
      receiver_id: body.receiver_id,
      message_name: subject,
      content: rendered,
      channel: template.channel,
      schedule_for: scheduleFor,
    });
  }

  async scheduleReminders(appointmentId: string): Promise<void> {
    const appointment = await this.repo.findAppointmentForRender(appointmentId);
    if (!appointment) return;

    const templates = await this.repo.findReminderTemplatesForDoctor(appointment.doctor_id);
    if (templates.length === 0) return;

    const placeholderData: Record<string, string> = {
      patient_name: appointment.patient_name,
      doctor_name: appointment.doctor_name,
      slot_time: formatSlotTime(appointment.scheduled_start),
      venue: appointment.venue_name || 'Unknown',
      clinic_name: appointment.clinic_name,
      token_number: appointment.token_number != null ? String(appointment.token_number) : '',
    };

    const now = new Date();

    for (const template of templates) {
      const offsetMs = template.offset_minutes! * 60 * 1000;
      const scheduleFor = new Date(appointment.scheduled_start.getTime() - offsetMs);

      if (scheduleFor <= now) continue;

      const rendered = renderTemplate(template.content, placeholderData);
      const subject = template.subject ? renderTemplate(template.subject, placeholderData) : null;

      await this.repo.insertMessage({
        appointment_id: appointment.id,
        template_id: template.id,
        sender_id: null,
        receiver_id: appointment.patient_id,
        message_name: subject,
        content: rendered,
        channel: template.channel,
        schedule_for: scheduleFor,
      });
    }
  }

  async cancelReminders(appointmentId: string): Promise<void> {
    await this.repo.cancelPendingByAppointment(appointmentId);
  }

  async processPending(batchSize: number = 10): Promise<number> {
    const messages = await this.repo.lockAndFetchPending(batchSize);
    let sentCount = 0;

    for (const msg of messages) {
      try {
        await this.deliver(msg);
        await this.repo.markSent(msg.id);
        sentCount++;
      } catch {
        await this.repo.incrementRetry(msg.id);
        if (msg.retry_count + 1 >= MAX_RETRIES) {
          await this.repo.markFailed(msg.id);
        }
      }
    }

    return sentCount;
  }

  async deliver(msg: { id: string; content: string; channel: string; receiver_id: string; clinic_id: string }): Promise<void> {
    const channelType = msg.channel as ChannelType;
    
    // Get the channel implementation
    const channel = channelRegistry.get(channelType);
    if (!channel) {
      throw new Error(`Unsupported channel: ${channelType}`);
    }
    
    // Get recipient's contact information based on channel type
    const recipient = await this.getRecipient(msg.receiver_id, channelType);
    if (!recipient) {
      throw new Error(`No contact information found for recipient: ${msg.receiver_id}`);
    }
    
    // Send the message through the channel
    const result = await channel.sendMessage({
      to: recipient,
      content: msg.content,
      clinicId: msg.clinic_id,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Message delivery failed');
    }
    
    console.log(`[MESSAGE] Sent to ${recipient} via ${channelType}: ${msg.content.slice(0, 100)}`);
  }

  /**
   * Get recipient's contact information based on channel type
   * @param userId - User ID of the recipient
   * @param channelType - Channel type (whatsapp, email, sms)
   * @returns Contact information or null if not found
   */
  private async getRecipient(userId: string, channelType: ChannelType): Promise<string | null> {
    const contact = await this.repo.getUserContact(userId);
    if (!contact) {
      return null;
    }
    
    switch (channelType) {
      case 'whatsapp':
        return contact.whatsapp_number || contact.mobile_number;
      case 'email':
        return contact.email;
      case 'sms':
        return contact.mobile_number;
      default:
        return null;
    }
  }
}

function renderTemplate(content: string, data: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] || `{{${key}}}`);
}

function formatSlotTime(d: Date): string {
  const offset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + offset);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = ist.getUTCDate();
  const month = months[ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  const hours = ist.getUTCHours();
  const minutes = String(ist.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${day} ${month} ${year}, ${h12}:${minutes} ${ampm} IST`;
}
