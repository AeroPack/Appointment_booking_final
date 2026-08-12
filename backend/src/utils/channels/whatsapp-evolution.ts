import axios, { AxiosError } from 'axios';
import type {
  MessageChannel,
  SendMessageParams,
  MessageResult,
  ChannelConfig,
  InteractiveMessage,
} from './types.js';
import { createSuccessResult, createErrorResult } from './utils.js';
import { normalizePhone, isValidPhone } from '../phone.js';
import pool from '../../config/db.js';

const AUTH_MESSAGE_TYPES = ['auth_otp', 'otp'];

interface EvolutionCredentials {
  apiUrl: string;
  apiKey: string;
}

export class WhatsAppEvolutionChannel implements MessageChannel {
  readonly channelType = 'whatsapp' as const;

  private readonly timeout = 10000;

  async sendMessage(params: SendMessageParams): Promise<MessageResult> {
    const { to, content, clinicId } = params;

    try {
      if (!isValidPhone(to)) {
        return createErrorResult('Invalid phone number format');
      }

      const credentials = this.getCredentials();
      if (!credentials) {
        return createErrorResult('Evolution API is not configured');
      }

      const recipient = normalizePhone(to);
      const doctorId = params.options?.['doctorId'] as string | undefined;
      const type = params.options?.['type'] as string | undefined;
      const isAuthMessage = typeof type === 'string' && AUTH_MESSAGE_TYPES.includes(type);

      // Resolve instance name
      let instanceName: string | null = null;

      if (isAuthMessage && !doctorId) {
        // Auth OTP without doctorId -> use system instance
        instanceName = process.env['EVO_SYSTEM_INSTANCE'] || 'chandan';
      } else if (doctorId) {
        // Doctor's chatbot message -> use their connected instance
        instanceName = await this.resolveInstance(doctorId);
      }

      if (!instanceName) {
        return createErrorResult('No WhatsApp instance available');
      }

      // Auth OTP -> plain text (Baileys doesn't support Cloud API templates)
      if (isAuthMessage) {
        const templateParam = params.options?.['params'];
        const otp = typeof templateParam === 'string' ? templateParam : '';
        return this.sendText(
          credentials,
          instanceName,
          recipient,
          `Your verification code is: ${otp}. It expires in 5 minutes.`
        );
      }

      // Interactive messages (list/buttons fallback to numbered text)
      const interactive = params.options?.['interactive'] as InteractiveMessage | undefined;
      if (interactive) {
        return this.sendInteractive(credentials, instanceName, recipient, interactive, content);
      }

      // Plain text
      return this.sendText(credentials, instanceName, recipient, content);
    } catch (error) {
      console.error('[WhatsAppEvolutionChannel] Error sending message:', error);

      if (error instanceof AxiosError) {
        const msg = error.response?.data?.message || error.message;
        return createErrorResult(`API request failed: ${msg}`, {
          status: error.response?.status,
        });
      }

      return createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  async validateConfig(clinicId: string): Promise<boolean> {
    try {
      const config = await this.getConfig(clinicId);
      return !!(config && config.enabled);
    } catch {
      return false;
    }
  }

  async getConfig(clinicId: string): Promise<ChannelConfig | null> {
    const credentials = this.getCredentials();
    if (!credentials) return null;

    return {
      clinicId,
      enabled: true,
      credentials: { apiUrl: credentials.apiUrl },
      whatsappNumber: '',
    };
  }

  private async sendText(
    credentials: EvolutionCredentials,
    instanceName: string,
    to: string,
    text: string
  ): Promise<MessageResult> {
    const response = await axios.post(
      `${credentials.apiUrl}/message/sendText/${instanceName}`,
      { number: to, text },
      { headers: this.headers(credentials.apiKey), timeout: this.timeout }
    );

    const messageId = response.data?.key?.id;
    return createSuccessResult(messageId, {
      provider: 'evolution',
      instance: instanceName,
      to,
      type: 'text',
    });
  }

  private async sendInteractive(
    credentials: EvolutionCredentials,
    instanceName: string,
    to: string,
    interactive: InteractiveMessage,
    fallback: string
  ): Promise<MessageResult> {
    if (interactive.kind === 'list') {
      return this.sendList(credentials, instanceName, to, interactive);
    }

    const numbered = interactive.buttons
      .map((b, i) => `${i + 1}. ${b.title}`)
      .join('\n');
    const text = `${interactive.body}\n\n${numbered}\n\nReply with 1-${interactive.buttons.length}.`;

    return this.sendText(credentials, instanceName, to, text);
  }

  private async sendList(
    credentials: EvolutionCredentials,
    instanceName: string,
    to: string,
    interactive: Extract<InteractiveMessage, { kind: 'list' }>
  ): Promise<MessageResult> {
    const sections = interactive.sections.map((s) => ({
      title: s.title,
      rows: s.rows.map((r) => ({
        title: r.title,
        description: r.description,
        rowId: r.id,
      })),
    }));

    const response = await axios.post(
      `${credentials.apiUrl}/message/sendList/${instanceName}`,
      {
        number: to,
        title: interactive.button,
        description: interactive.body,
        buttonText: interactive.button,
        footerText: '',
        sections,
      },
      { headers: this.headers(credentials.apiKey), timeout: this.timeout }
    );

    const messageId = response.data?.key?.id;
    return createSuccessResult(messageId, {
      provider: 'evolution',
      instance: instanceName,
      to,
      type: 'list',
    });
  }

  private async resolveInstance(doctorId: string): Promise<string | null> {
    const result = await pool.query(
      `SELECT evolution_instance_name FROM doctor_chatbot_config
       WHERE doctor_id = $1 AND evolution_connection_status = 'connected'`,
      [doctorId]
    );
    return result.rows[0]?.evolution_instance_name ?? null;
  }

  private getCredentials(): EvolutionCredentials | null {
    const apiUrl = process.env['EVOLUTION_API_URL'];
    const apiKey = process.env['EVOLUTION_API_KEY'];
    if (!apiUrl || !apiKey) return null;
    return { apiUrl, apiKey };
  }

  private headers(apiKey: string) {
    return { apikey: apiKey, 'Content-Type': 'application/json' };
  }
}
