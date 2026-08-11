/**
 * WhatsApp Cloud API Channel Implementation
 *
 * Implements the MessageChannel interface against Meta's official WhatsApp
 * Cloud API (graph.facebook.com). Unlike the BhashSMS gateway in whatsapp.ts,
 * this provider supports interactive reply buttons and list pickers, which the
 * booking flow needs to offer appointment slots.
 *
 * Three send shapes:
 *  - text:        plain prompts (only valid inside the 24h customer window)
 *  - interactive: reply buttons / list picker (also 24h-window only)
 *  - template:    approved template, the only thing deliverable outside the window
 */

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

/**
 * Meta's caps on interactive messages. Exceeding any of these is a 400 from
 * the Graph API, so we clamp before sending rather than discover at runtime.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 */
const LIMITS = {
  bodyChars: 1024,
  buttonCount: 3,
  buttonTitleChars: 20,
  listButtonChars: 20,
  listRowsTotal: 10,
  listRowTitleChars: 24,
  listRowDescChars: 72,
  sectionTitleChars: 24,
} as const;

/** Option values of `type` that identify a message as an authentication code */
const AUTH_MESSAGE_TYPES = ['auth_otp', 'otp'];

interface CloudCredentials {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
}

/** Shape of the JSON body POSTed to the Graph API messages endpoint. */
type CloudPayload = Record<string, unknown>;

export class WhatsAppCloudChannel implements MessageChannel {
  readonly channelType = 'whatsapp' as const;

  private readonly defaultApiVersion = 'v21.0';
  private readonly defaultAuthTemplate = 'aero_auth';
  private readonly defaultTemplateLang = 'en';
  private readonly timeout = 10000;

  /**
   * Send a WhatsApp message through the Cloud API
   * @param params - Message parameters; `options.interactive` upgrades the send
   *                 to buttons/list, `options.type` of 'otp' sends a template
   * @returns Promise resolving to MessageResult
   */
  async sendMessage(params: SendMessageParams): Promise<MessageResult> {
    const { to, content, clinicId } = params;

    try {
      if (!isValidPhone(to)) {
        return createErrorResult('Invalid phone number format');
      }

      const config = await this.getConfig(clinicId);
      if (!config || !config.enabled) {
        return createErrorResult('WhatsApp is not enabled for this clinic');
      }

      const credentials = this.getCredentials();
      if (!credentials) {
        return createErrorResult('WhatsApp Cloud API configuration is incomplete');
      }

      const recipient = normalizePhone(to);
      const payload = this.buildPayload(recipient, content, params.options);

      return await this.post(credentials, payload, recipient);
    } catch (error) {
      console.error('[WhatsAppCloudChannel] Error sending message:', error);

      if (error instanceof AxiosError) {
        // Meta nests the useful part; the raw axios message is just "400".
        const apiError = error.response?.data?.error;
        return createErrorResult(
          apiError?.message || `API request failed: ${error.message}`,
          { status: error.response?.status, code: apiError?.code, details: apiError?.error_data?.details }
        );
      }

      return createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * Validate if WhatsApp is properly configured for a clinic
   * @param clinicId - Clinic ID to check
   * @returns Promise resolving to true if configured, false otherwise
   */
  async validateConfig(clinicId: string): Promise<boolean> {
    try {
      const config = await this.getConfig(clinicId);
      return !!(config && config.enabled);
    } catch {
      return false;
    }
  }

  /**
   * Get WhatsApp configuration for a clinic
   *
   * The Cloud API number is app-level, same as the BhashSMS account it
   * replaces, so availability depends only on the credentials being present.
   * @param clinicId - Clinic ID
   * @returns Promise resolving to ChannelConfig or null
   */
  async getConfig(clinicId: string): Promise<ChannelConfig | null> {
    const credentials = this.getCredentials();
    if (!credentials) {
      return null;
    }

    return {
      clinicId,
      enabled: true,
      credentials: { phoneNumberId: credentials.phoneNumberId },
      whatsappNumber: '',
    };
  }

  /**
   * Choose and build the Graph API request body for this send.
   * @param to - Recipient in digits-with-country-code form
   * @param content - Plain-text body, and the fallback for every shape
   * @param options - Caller options (`interactive`, `type`, `params`)
   * @returns The JSON payload to POST
   */
  private buildPayload(
    to: string,
    content: string,
    options: SendMessageParams['options']
  ): CloudPayload {
    const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };

    const type = options?.['type'];
    if (typeof type === 'string' && AUTH_MESSAGE_TYPES.includes(type)) {
      const templateParam = options?.['params'];
      if (typeof templateParam === 'string' && templateParam !== '') {
        return { ...base, ...this.buildTemplate(templateParam) };
      }
      // A template call without its variable is rejected outright, so fall back
      // to plain text: a code that arrives as text beats one that never arrives.
      console.warn(
        `[WhatsAppCloudChannel] Message type '${type}' has no options.params, falling back to a text send`
      );
    }

    const interactive = options?.['interactive'] as InteractiveMessage | undefined;
    if (interactive) {
      return { ...base, ...this.buildInteractive(interactive, content) };
    }

    return { ...base, type: 'text', text: { preview_url: false, body: this.clamp(content, LIMITS.bodyChars) } };
  }

  /**
   * Build an authentication template send.
   * @param code - The one-time code substituted into the template body
   * @returns Partial payload carrying the template component
   */
  private buildTemplate(code: string): CloudPayload {
    const name = process.env['WA_AUTH_TEMPLATE'] || this.defaultAuthTemplate;
    const language = process.env['WA_CLOUD_TEMPLATE_LANG'] || this.defaultTemplateLang;

    return {
      type: 'template',
      template: {
        name,
        language: { code: language },
        // Authentication templates that carry a copy-code button also need a
        // matching button component. Add it here if the approved template has one.
        components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
      },
    };
  }

  /**
   * Map the provider-agnostic interactive shape onto Meta's schema, clamping
   * every field to the documented limit.
   * @param interactive - What the flow engine wants to offer
   * @param fallback - Plain-text rendering, used if the shape is unusable
   * @returns Partial payload carrying the interactive object
   */
  private buildInteractive(interactive: InteractiveMessage, fallback: string): CloudPayload {
    if (interactive.kind === 'buttons') {
      const buttons = interactive.buttons.slice(0, LIMITS.buttonCount).map((b) => ({
        type: 'reply',
        reply: { id: b.id, title: this.clamp(b.title, LIMITS.buttonTitleChars) },
      }));

      if (buttons.length === 0) {
        return { type: 'text', text: { preview_url: false, body: this.clamp(fallback, LIMITS.bodyChars) } };
      }

      return {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: this.clamp(interactive.body, LIMITS.bodyChars) },
          action: { buttons },
        },
      };
    }

    // Lists cap at 10 rows across ALL sections, not per section, so the budget
    // is spent in order and later sections may come up empty.
    let remaining = LIMITS.listRowsTotal;
    const sections = [];
    for (const section of interactive.sections) {
      if (remaining <= 0) break;
      const rows = section.rows.slice(0, remaining).map((r) => ({
        id: r.id,
        title: this.clamp(r.title, LIMITS.listRowTitleChars),
        ...(r.description ? { description: this.clamp(r.description, LIMITS.listRowDescChars) } : {}),
      }));
      if (rows.length === 0) continue;
      remaining -= rows.length;
      sections.push({
        ...(section.title ? { title: this.clamp(section.title, LIMITS.sectionTitleChars) } : {}),
        rows,
      });
    }

    if (sections.length === 0) {
      return { type: 'text', text: { preview_url: false, body: this.clamp(fallback, LIMITS.bodyChars) } };
    }

    return {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: this.clamp(interactive.body, LIMITS.bodyChars) },
        action: { button: this.clamp(interactive.button, LIMITS.listButtonChars), sections },
      },
    };
  }

  /**
   * POST the payload to the Graph API messages endpoint.
   * @param credentials - Resolved Cloud API credentials
   * @param payload - Request body
   * @param to - Recipient, echoed into result metadata
   * @returns Promise resolving to MessageResult
   */
  private async post(
    credentials: CloudCredentials,
    payload: CloudPayload,
    to: string
  ): Promise<MessageResult> {
    // WA_CLOUD_API_BASE exists so the check script can point this at a local
    // stub. It has no production use - leave it unset.
    const base = process.env['WA_CLOUD_API_BASE'] || 'https://graph.facebook.com';
    const url = `${base}/${credentials.apiVersion}/${credentials.phoneNumberId}/messages`;

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: this.timeout,
    });

    const messageId = response.data?.messages?.[0]?.id as string | undefined;
    if (!messageId) {
      return createErrorResult('WhatsApp Cloud API returned no message id', {
        provider: 'whatsapp_cloud',
        response: response.data,
      });
    }

    return createSuccessResult(messageId, {
      provider: 'whatsapp_cloud',
      to,
      type: payload.type,
    });
  }

  /**
   * Resolve Cloud API credentials from environment configuration.
   * @returns Credentials, or null if the integration is not configured
   */
  private getCredentials(): CloudCredentials | null {
    const phoneNumberId = process.env['WA_CLOUD_PHONE_NUMBER_ID'];
    const accessToken = process.env['WA_CLOUD_ACCESS_TOKEN'];

    if (!phoneNumberId || !accessToken) {
      return null;
    }

    return {
      phoneNumberId,
      accessToken,
      apiVersion: process.env['WA_CLOUD_API_VERSION'] || this.defaultApiVersion,
    };
  }

  /**
   * Trim a string to a provider limit without emitting an ellipsis that would
   * eat into an already-tight budget.
   * @param value - Text to clamp
   * @param max - Maximum length allowed by the provider
   * @returns The value, truncated if it was over the limit
   */
  private clamp(value: string, max: number): string {
    return value.length <= max ? value : value.slice(0, max);
  }
}
