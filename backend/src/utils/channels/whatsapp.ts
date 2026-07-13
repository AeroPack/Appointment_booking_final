/**
 * WhatsApp Channel Implementation
 * 
 * Implements the MessageChannel interface for WhatsApp messaging
 * using the UltraMsg API.
 */

import axios, { AxiosError } from 'axios';
import type { MessageChannel, SendMessageParams, MessageResult, ChannelConfig } from './types.js';
import { createSuccessResult, createErrorResult } from './utils.js';
import pool from '../../config/db.js';

/**
 * UltraMsg API configuration interface
 */
interface UltraMsgConfig {
  instanceId: string;
  token: string;
  whatsappNumber: string;
  enabled: boolean;
}

/**
 * UltraMsg API response interface
 */
interface UltraMsgResponse {
  sent?: boolean;
  id?: string;
  error?: string;
  message?: string;
}

/**
 * WhatsApp channel implementation using UltraMsg API
 * 
 * This class handles sending WhatsApp messages through the UltraMsg API.
 * It fetches configuration from the clinics table and validates it before
 * sending messages.
 */
export class WhatsAppChannel implements MessageChannel {
  readonly channelType = 'whatsapp' as const;
  
  private readonly defaultApiBaseUrl = 'https://api.ultramsg.com';
  private readonly timeout = 10000; // 10 seconds

  /**
   * Send a WhatsApp message
   * @param params - Message parameters
   * @returns Promise resolving to MessageResult
   */
  async sendMessage(params: SendMessageParams): Promise<MessageResult> {
    const { to, content, clinicId, options } = params;
    
    try {
      // Validate phone number format
      if (!this.isValidPhoneNumber(to)) {
        return createErrorResult('Invalid phone number format');
      }

      // Get UltraMsg configuration for this clinic
      const config = await this.getConfig(clinicId);
      if (!config || !config.enabled) {
        return createErrorResult('WhatsApp is not enabled for this clinic');
      }

      // Validate required fields
      if (!config.instanceId || !config.token) {
        return createErrorResult('UltraMsg configuration is incomplete');
      }

      // Format phone number (ensure it starts with +)
      const formattedNumber = this.formatPhoneNumber(to);

      // Send message via UltraMsg API
      const response = await this.callUltraMsgApi(
        config.instanceId,
        config.token,
        formattedNumber,
        content,
        options
      );

      if (response.sent) {
        return createSuccessResult(response.id, {
          provider: 'ultramsg',
          to: formattedNumber,
        });
      } else {
        return createErrorResult(
          response.error || response.message || 'Failed to send message',
          { provider: 'ultramsg', response }
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
      return !!(config && config.enabled && config.instanceId && config.token);
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
    try {
      // First try to get from database
      const result = await pool.query(
        `SELECT ultramsg_instance_id, ultramsg_token, whatsapp_number, whatsapp_enabled
         FROM clinics WHERE id = $1`,
        [clinicId]
      );

      const clinic = result.rows[0];
      
      // If clinic exists in database and has configuration, use it
      if (clinic && clinic.ultramsg_instance_id && clinic.ultramsg_token) {
        return {
          clinicId,
          enabled: clinic.whatsapp_enabled || false,
          credentials: {
            instanceId: clinic.ultramsg_instance_id,
            token: clinic.ultramsg_token,
            whatsappNumber: clinic.whatsapp_number || '',
          },
          instanceId: clinic.ultramsg_instance_id,
          token: clinic.ultramsg_token,
          whatsappNumber: clinic.whatsapp_number || '',
        };
      }
      
      // Fallback to ULTRAMSG_* environment variables if database config is not available
      const envInstanceId = process.env['ULTRAMSG_INSTANCE_ID'];
      const envToken = process.env['ULTRAMSG_TOKEN'];
      
      if (envInstanceId && envToken) {
        return {
          clinicId,
          enabled: true, // Default to enabled when using env vars
          credentials: {
            instanceId: envInstanceId,
            token: envToken,
            whatsappNumber: '',
          },
          instanceId: envInstanceId,
          token: envToken,
          whatsappNumber: '',
        };
      }
      
      // Final fallback to APP_WHATSAPP_* environment variables (app-level config)
      const appInstanceId = process.env['APP_WHATSAPP_INSTANCE_ID'];
      const appToken = process.env['APP_WHATSAPP_TOKEN'];
      const appEnabled = process.env['APP_WHATSAPP_ENABLED'] === 'true';
      
      if (appInstanceId && appToken && appEnabled) {
        return {
          clinicId,
          enabled: true,
          credentials: {
            instanceId: appInstanceId,
            token: appToken,
            whatsappNumber: '',
          },
          instanceId: appInstanceId,
          token: appToken,
          whatsappNumber: '',
        };
      }
      
      // No configuration found
      return null;
    } catch (error) {
      console.error('[WhatsAppChannel] Error fetching config:', error);
      
      // Fallback to ULTRAMSG_* environment variables on error
      const envInstanceId = process.env['ULTRAMSG_INSTANCE_ID'];
      const envToken = process.env['ULTRAMSG_TOKEN'];
      
      if (envInstanceId && envToken) {
        return {
          clinicId,
          enabled: true,
          credentials: {
            instanceId: envInstanceId,
            token: envToken,
            whatsappNumber: '',
          },
          instanceId: envInstanceId,
          token: envToken,
          whatsappNumber: '',
        };
      }
      
      // Final fallback to APP_WHATSAPP_* environment variables
      const appInstanceId = process.env['APP_WHATSAPP_INSTANCE_ID'];
      const appToken = process.env['APP_WHATSAPP_TOKEN'];
      const appEnabled = process.env['APP_WHATSAPP_ENABLED'] === 'true';
      
      if (appInstanceId && appToken && appEnabled) {
        return {
          clinicId,
          enabled: true,
          credentials: {
            instanceId: appInstanceId,
            token: appToken,
            whatsappNumber: '',
          },
          instanceId: appInstanceId,
          token: appToken,
          whatsappNumber: '',
        };
      }
      
      return null;
    }
  }

  /**
   * Call the UltraMsg API to send a message
   * @param instanceId - UltraMsg instance ID
   * @param token - UltraMsg API token
   * @param to - Recipient phone number
   * @param message - Message content
   * @param options - Additional options
   * @returns Promise resolving to UltraMsgResponse
   */
  private async callUltraMsgApi(
    instanceId: string,
    token: string,
    to: string,
    message: string,
    options?: Record<string, unknown>
  ): Promise<UltraMsgResponse> {
    // Use custom API URL from env vars if available, otherwise construct from instanceId
    // Priority: ULTRAMSG_API_URL -> APP_WHATSAPP_API_URL -> default
    const apiBaseUrl = process.env['ULTRAMSG_API_URL'] || 
                       process.env['APP_WHATSAPP_API_URL'] || 
                       this.defaultApiBaseUrl;
    const url = `${apiBaseUrl}/${instanceId}/messages/chat`;
    
    const data = new URLSearchParams();
    data.append('token', token);
    data.append('to', to);
    data.append('body', message);
    
    // Add optional parameters
    if (options?.reference) {
      data.append('reference', String(options.reference));
    }

    const response = await axios.post<UltraMsgResponse>(url, data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: this.timeout,
    });

    return response.data;
  }

  /**
   * Validate phone number format
   * @param phoneNumber - Phone number to validate
   * @returns True if valid, false otherwise
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic validation: should contain only digits, +, -, (, ), and spaces
    const phoneRegex = /^[+\d\s\-()]+$/;
    if (!phoneRegex.test(phoneNumber)) {
      return false;
    }
    
    // Extract digits only and check length
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
  }

  /**
   * Format phone number to ensure it starts with +
   * @param phoneNumber - Phone number to format
   * @returns Formatted phone number
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any spaces, dashes, or parentheses
    let cleaned = phoneNumber.replace(/[\s\-()]/g, '');
    
    // Ensure it starts with +
    if (!cleaned.startsWith('+')) {
      // If it starts with 0, assume local number and add country code
      // This is a simple heuristic - in production, you might want to
      // use a proper phone number library
      if (cleaned.startsWith('0')) {
        cleaned = '+91' + cleaned.substring(1); // Assuming India
      } else if (/^\d{10}$/.test(cleaned)) {
        cleaned = '+91' + cleaned; // Bare 10-digit Indian number
      } else {
        cleaned = '+' + cleaned;
      }
    }
    
    return cleaned;
  }
}
