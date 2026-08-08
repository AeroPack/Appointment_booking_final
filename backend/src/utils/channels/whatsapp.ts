/**
 * WhatsApp Channel Implementation
 *
 * Implements the MessageChannel interface for WhatsApp messaging
 * using the BhashSMS WhatsApp gateway (sendmsgutil.php).
 *
 * Two send modes share the endpoint:
 *  - normal: free-text body, stype=normal
 *  - auth:   approved template (text=<template name>, Params=<otp>), stype=auth
 */

import axios, { AxiosError } from 'axios';
import type { MessageChannel, SendMessageParams, MessageResult, ChannelConfig } from './types.js';
import { createSuccessResult, createErrorResult } from './utils.js';
import { normalizePhone, isValidPhone } from '../phone.js';

/**
 * Gateway credentials resolved from environment configuration
 */
interface GatewayCredentials {
  user: string;
  pass: string;
  sender: string;
}

/**
 * Send mode. Authentication codes must go through an approved WhatsApp
 * template; everything else is sent as a free-text body.
 */
type SendMode = 'auth' | 'normal';

/** Option values of `type` that identify a message as an authentication code */
const AUTH_MESSAGE_TYPES = ['auth_otp', 'otp'];

/**
 * WhatsApp channel implementation using the BhashSMS gateway
 *
 * Messages are sent through the gateway's sendmsgutil.php endpoint. Gateway
 * credentials are app-level (environment variables); the clinics table only
 * controls whether the channel is enabled for a clinic.
 */
export class WhatsAppChannel implements MessageChannel {
  readonly channelType = 'whatsapp' as const;

  private readonly defaultApiUrl = 'http://bhashsms.com/api/sendmsgutil.php';
  private readonly defaultSender = 'BUZWAP';
  private readonly defaultAuthTemplate = 'aero_auth';
  private readonly timeout = 10000; // 10 seconds

  /**
   * Send a WhatsApp message
   * @param params - Message parameters
   * @returns Promise resolving to MessageResult
   */
  async sendMessage(params: SendMessageParams): Promise<MessageResult> {
    const { to, content, clinicId } = params;

    try {
      // Validate phone number format
      if (!this.isValidPhoneNumber(to)) {
        return createErrorResult('Invalid phone number format');
      }

      // Get WhatsApp configuration for this clinic
      const config = await this.getConfig(clinicId);
      if (!config || !config.enabled) {
        return createErrorResult('WhatsApp is not enabled for this clinic');
      }

      const { mode, templateParam } = this.resolveSendMode(params.options);

      const credentials = this.getGatewayCredentials(mode);
      if (!credentials) {
        return createErrorResult('WhatsApp gateway configuration is incomplete');
      }

      // Gateway expects a digits-only number including the country code
      const formattedNumber = this.formatPhoneNumber(to);

      const response = mode === 'auth'
        ? await this.callGatewayApi(credentials, formattedNumber, this.getAuthTemplate(), templateParam!)
        : await this.callGatewayApi(credentials, formattedNumber, content);

      if (response.sent) {
        return createSuccessResult(response.id, {
          provider: 'bhashsms',
          to: formattedNumber,
          mode,
        });
      } else {
        return createErrorResult(
          response.error || 'Failed to send message',
          { provider: 'bhashsms', mode, response: response.raw }
        );
      }
    } catch (error) {
      console.error('[WhatsAppChannel] Error sending message:', error);
      
      if (error instanceof AxiosError) {
        return createErrorResult(
          `API request failed: ${error.message}`,
          { status: error.response?.status, data: error.response?.data }
        );
      }
      
      return createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
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
   * @param clinicId - Clinic ID
   * @returns Promise resolving to ChannelConfig or null
   */
  async getConfig(clinicId: string): Promise<ChannelConfig | null> {
    // ponytail: the gateway account is app-level, so availability depends only
    // on the gateway credentials. clinics.whatsapp_enabled is not consulted -
    // it defaults to false and the previous env fallback already bypassed it.
    // Wire it back in here if per-clinic opt-out is ever needed.
    // Either account counts as configured; sendMessage() still checks the
    // credentials for the mode it actually uses.
    const credentials =
      this.getGatewayCredentials('normal') || this.getGatewayCredentials('auth');
    if (!credentials) {
      return null;
    }

    return {
      clinicId,
      enabled: true,
      credentials: {
        user: credentials.user,
        sender: credentials.sender,
      },
      whatsappNumber: '',
    };
  }

  /**
   * Decide whether this send uses the auth template or a free-text body
   * @param options - Caller-supplied options (`type`, `params`)
   * @returns The send mode and, for auth sends, the template variable
   */
  private resolveSendMode(
    options: SendMessageParams['options']
  ): { mode: SendMode; templateParam?: string } {
    const type = options?.['type'];
    if (typeof type !== 'string' || !AUTH_MESSAGE_TYPES.includes(type)) {
      return { mode: 'normal' };
    }

    const templateParam = options?.['params'];
    if (typeof templateParam !== 'string' || templateParam === '') {
      // A template call without its variable is rejected by the gateway, so
      // fall back to the free-text body: a code that arrives as plain text
      // beats one that never arrives.
      console.warn(
        `[WhatsAppChannel] Message type '${type}' has no options.params, falling back to a free-text send`
      );
      return { mode: 'normal' };
    }

    return { mode: 'auth', templateParam };
  }

  /**
   * Resolve the approved template name used for authentication codes
   * @returns Template name sent as the gateway's `text` parameter
   */
  private getAuthTemplate(): string {
    return process.env['WA_AUTH_TEMPLATE'] || this.defaultAuthTemplate;
  }

  /**
   * Resolve gateway credentials from environment configuration
   *
   * Authentication codes are sent from a separate gateway account; its
   * WA_AUTH_* variables fall back to the general WA_GATEWAY_* ones when unset.
   * @param mode - Which gateway account to use
   * @returns Credentials or null if the gateway is not configured
   */
  private getGatewayCredentials(mode: SendMode): GatewayCredentials | null {
    const isAuth = mode === 'auth';
    const user = (isAuth && process.env['WA_AUTH_USER']) || process.env['WA_GATEWAY_USER'];
    const pass = (isAuth && process.env['WA_AUTH_PASS']) || process.env['WA_GATEWAY_PASS'];

    if (!user || !pass) {
      return null;
    }

    return {
      user,
      pass,
      sender:
        (isAuth && process.env['WA_AUTH_SENDER']) ||
        process.env['WA_GATEWAY_SENDER'] ||
        this.defaultSender,
    };
  }

  /**
   * Call the BhashSMS gateway to send a WhatsApp message
   * @param credentials - Gateway credentials
   * @param to - Recipient phone number (digits with country code)
   * @param message - Free-text body, or the template name for an auth send
   * @param templateParam - Template variable (the OTP); its presence selects the auth send
   * @returns Promise resolving to the parsed gateway result
   */
  private async callGatewayApi(
    credentials: GatewayCredentials,
    to: string,
    message: string,
    templateParam?: string
  ): Promise<{ sent: boolean; id?: string; error?: string; raw: string }> {
    const isAuth = templateParam !== undefined;
    const url =
      (isAuth && process.env['WA_AUTH_URL']) ||
      process.env['WA_GATEWAY_URL'] ||
      this.defaultApiUrl;

    const response = await axios.get(url, {
      params: {
        user: credentials.user,
        pass: credentials.pass,
        sender: credentials.sender,
        phone: to,
        text: message,
        priority: 'wa',
        stype: isAuth ? 'auth' : 'normal',
        // Capital P: the gateway is case-sensitive on this one.
        ...(isAuth ? { Params: templateParam } : {}),
      },
      timeout: this.timeout,
      responseType: 'text',
      transformResponse: [(data: unknown) => data],
    });

    // The gateway replies with plain text: a message id on success,
    // or a message containing "error"/"invalid" on failure.
    const raw = String(response.data ?? '').trim();
    const isFailure = raw === '' || /error|invalid|fail/i.test(raw);

    if (isFailure) {
      return { sent: false, error: raw || 'Empty response from WhatsApp gateway', raw };
    }

    return { sent: true, id: raw, raw };
  }

  /**
   * Validate phone number format
   * @param phoneNumber - Phone number to validate
   * @returns True if valid, false otherwise
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    return isValidPhone(phoneNumber);
  }

  /**
   * Format phone number for the gateway: digits only, with country code
   * @param phoneNumber - Phone number to format
   * @returns Formatted phone number
   */
  private formatPhoneNumber(phoneNumber: string): string {
    return normalizePhone(phoneNumber);
  }
}
