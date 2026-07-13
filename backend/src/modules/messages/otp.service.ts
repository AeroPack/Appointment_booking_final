/**
 * OTP Service
 * 
 * Handles OTP generation, sending, and verification for authentication.
 * Uses the channel abstraction layer to send OTPs via WhatsApp, email, or SMS.
 */

import crypto from 'crypto';
import { AppError } from '../../utils/response.js';
import { MessagesRepository } from './messages.repository.js';
import { channelRegistry } from '../../utils/channels/index.js';
import type { ChannelType } from '../../utils/channels/types.js';
import pool from '../../config/db.js';

/**
 * OTP configuration
 */
const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 5,
  MAX_ATTEMPTS: 3,
  HASH_ITERATIONS: 10000,
  SALT_LENGTH: 16,
};

/**
 * OTP Service for handling verification codes
 */
export class OtpService {
  constructor(private readonly repo: MessagesRepository) {}

  /**
   * Generate and send OTP to a recipient
   * @param params - OTP parameters
   * @returns Promise resolving to OTP ID (for tracking)
   */
  async sendOtp(params: {
    identifier: string; // mobile number or email
    clinicId: string;
    channel: ChannelType;
  }): Promise<{ otpId: string }> {
    const { identifier, clinicId, channel } = params;
    
    // Validate channel is supported
    if (!channelRegistry.isSupported(channel)) {
      throw new AppError(400, 'UNSUPPORTED_CHANNEL', `Channel '${channel}' is not supported`);
    }
    
    // Validate identifier format based on channel
    this.validateIdentifier(identifier, channel);
    
    // Check if channel is configured for this clinic
    const isConfigured = await channelRegistry.get(channel)!.validateConfig(clinicId);
    if (!isConfigured) {
      throw new AppError(400, 'CHANNEL_NOT_CONFIGURED', `Channel '${channel}' is not configured for this clinic`);
    }
    
    // Generate OTP
    const otp = this.generateOtp();
    const otpHash = await this.hashOtp(otp);
    
    // Store OTP in database
    const otpId = await this.storeOtp(identifier, otpHash, clinicId);
    
    // Get clinic's OTP template or use default message
    const template = await this.repo.findOtpTemplateForClinic(clinicId);
    const message = template 
      ? this.renderTemplate(template.content, { otp, identifier })
      : `Your verification code is: ${otp}. It expires in ${OTP_CONFIG.EXPIRY_MINUTES} minutes.`;
    
    // Send OTP via selected channel
    const channelImpl = channelRegistry.getOrThrow(channel);
    const result = await channelImpl.sendMessage({
      to: identifier,
      content: message,
      clinicId,
      options: { type: 'otp', otpId },
    });
    
    if (!result.success) {
      throw new AppError(500, 'OTP_SEND_FAILED', result.error || 'Failed to send OTP');
    }
    
    return { otpId };
  }

  /**
   * Verify an OTP
   * @param params - Verification parameters
   * @returns Promise resolving to true if valid, false otherwise
   */
  async verifyOtp(params: {
    identifier: string;
    otp: string;
    otpId?: string;
  }): Promise<boolean> {
    const { identifier, otp, otpId } = params;
    
    // Validate OTP format
    if (!this.isValidOtpFormat(otp)) {
      throw new AppError(400, 'INVALID_OTP_FORMAT', 'OTP must be a 6-digit number');
    }
    
    // Find the OTP record
    const otpRecord = await this.findOtp(identifier, otpId);
    if (!otpRecord) {
      throw new AppError(400, 'OTP_NOT_FOUND', 'OTP not found or expired');
    }
    
    // Check if OTP is expired
    if (this.isOtpExpired(otpRecord.expires_at)) {
      throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired');
    }
    
    // Check if OTP is already used
    if (otpRecord.used) {
      throw new AppError(400, 'OTP_USED', 'OTP has already been used');
    }
    
    // Check attempt count
    if (otpRecord.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
      throw new AppError(400, 'OTP_MAX_ATTEMPTS', 'Maximum verification attempts exceeded');
    }
    
    // Verify OTP hash
    const isValid = await this.verifyOtpHash(otp, otpRecord.otp_hash);
    
    // Increment attempt count
    await this.incrementOtpAttempts(otpRecord.id);
    
    if (isValid) {
      // Mark OTP as used
      await this.markOtpUsed(otpRecord.id);
    }
    
    return isValid;
  }

  /**
   * Generate a random 6-digit OTP
   * @returns OTP string
   */
  private generateOtp(): string {
    const min = Math.pow(10, OTP_CONFIG.LENGTH - 1);
    const max = Math.pow(10, OTP_CONFIG.LENGTH) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  /**
   * Hash an OTP using PBKDF2
   * @param otp - Plain text OTP
   * @returns Hashed OTP
   */
  private async hashOtp(otp: string): Promise<string> {
    const salt = crypto.randomBytes(OTP_CONFIG.SALT_LENGTH).toString('hex');
    const hash = crypto.pbkdf2Sync(
      otp,
      salt,
      OTP_CONFIG.HASH_ITERATIONS,
      64,
      'sha512'
    ).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify OTP against stored hash
   * @param otp - Plain text OTP
   * @param storedHash - Stored hash
   * @returns True if valid, false otherwise
   */
  private async verifyOtpHash(otp: string, storedHash: string): Promise<boolean> {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(
      otp,
      salt,
      OTP_CONFIG.HASH_ITERATIONS,
      64,
      'sha512'
    ).toString('hex');
    return hash === verifyHash;
  }

  /**
   * Store OTP in database
   * @param identifier - Mobile number or email
   * @param otpHash - Hashed OTP
   * @param clinicId - Clinic ID
   * @returns OTP ID
   */
  private async storeOtp(
    identifier: string, 
    otpHash: string, 
    clinicId: string
  ): Promise<string> {
    const expiresAt = new Date(Date.now() + OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000);
    
    // Determine if identifier is email or mobile
    const isEmail = identifier.includes('@');
    
    const result = await pool.query(
      `INSERT INTO otps (mobile_number, email, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        isEmail ? null : identifier,
        isEmail ? identifier : null,
        otpHash,
        expiresAt,
      ]
    );
    
    return result.rows[0].id;
  }

  /**
   * Find an OTP record
   * @param identifier - Mobile number or email
   * @param otpId - Optional OTP ID to find specific OTP
   * @returns OTP record or null
   */
  private async findOtp(
    identifier: string, 
    otpId?: string
  ): Promise<{
    id: string;
    otp_hash: string;
    expires_at: Date;
    used: boolean;
    attempts: number;
  } | null> {
    const isEmail = identifier.includes('@');
    
    let query = `
      SELECT id, otp_hash, expires_at, used, attempts
      FROM otps
      WHERE ${isEmail ? 'email = $1' : 'mobile_number = $1'}
        AND used = false
        AND expires_at > NOW()
    `;
    const params: unknown[] = [identifier];
    
    if (otpId) {
      query += ' AND id = $2';
      params.push(otpId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 1';
    
    const result = await pool.query(query, params);
    return result.rows[0] || null;
  }

  /**
   * Check if OTP is expired
   * @param expiresAt - Expiration timestamp
   * @returns True if expired
   */
  private isOtpExpired(expiresAt: Date): boolean {
    return new Date() > new Date(expiresAt);
  }

  /**
   * Increment OTP attempt count
   * @param otpId - OTP ID
   */
  private async incrementOtpAttempts(otpId: string): Promise<void> {
    await pool.query(
      'UPDATE otps SET attempts = attempts + 1 WHERE id = $1',
      [otpId]
    );
  }

  /**
   * Mark OTP as used
   * @param otpId - OTP ID
   */
  private async markOtpUsed(otpId: string): Promise<void> {
    await pool.query(
      'UPDATE otps SET used = true WHERE id = $1',
      [otpId]
    );
  }

  /**
   * Validate identifier format based on channel
   * @param identifier - Mobile number or email
   * @param channel - Channel type
   */
  private validateIdentifier(identifier: string, channel: ChannelType): void {
    switch (channel) {
      case 'whatsapp':
      case 'sms':
        // Basic phone number validation
        if (!/^[+\d\s\-()]+$/.test(identifier)) {
          throw new AppError(400, 'INVALID_PHONE', 'Invalid phone number format');
        }
        break;
      case 'email':
        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
          throw new AppError(400, 'INVALID_EMAIL', 'Invalid email format');
        }
        break;
      default:
        throw new AppError(400, 'UNSUPPORTED_CHANNEL', `Unsupported channel: ${channel}`);
    }
  }

  /**
   * Validate OTP format
   * @param otp - OTP to validate
   * @returns True if valid format
   */
  private isValidOtpFormat(otp: string): boolean {
    return /^\d{6}$/.test(otp);
  }

  /**
   * Render template with placeholders
   * @param template - Template string
   * @param data - Placeholder data
   * @returns Rendered string
   */
  private renderTemplate(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] || `{{${key}}}`);
  }
}
