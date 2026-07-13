/**
 * Channel Abstraction Layer Types
 * 
 * This module defines the interface for message channels (WhatsApp, Email, SMS).
 * All channel implementations must implement the MessageChannel interface.
 */

/**
 * Result of a message sending operation
 */
export interface MessageResult {
  /** Whether the message was sent successfully */
  success: boolean;
  /** Optional message ID from the provider */
  messageId?: string;
  /** Error message if sending failed */
  error?: string;
  /** Timestamp of the operation */
  timestamp: Date;
  /** Optional metadata from the provider */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for sending a message through a channel
 */
export interface SendMessageParams {
  /** Recipient's contact information (phone number, email, etc.) */
  to: string;
  /** Message content (text, HTML, etc.) */
  content: string;
  /** Clinic ID for configuration lookup */
  clinicId: string;
  /** Optional additional parameters specific to the channel */
  options?: Record<string, unknown>;
}

/**
 * Channel configuration for a clinic
 */
export interface ChannelConfig {
  /** Clinic ID */
  clinicId: string;
  /** Whether this channel is enabled for the clinic */
  enabled: boolean;
  /** Channel-specific credentials */
  credentials: Record<string, string>;
  /** UltraMsg instance ID (for WhatsApp) */
  instanceId?: string;
  /** UltraMsg token (for WhatsApp) */
  token?: string;
  /** WhatsApp number (for WhatsApp) */
  whatsappNumber?: string;
}

/**
 * Message channel interface
 * 
 * All channel implementations must implement this interface.
 * This ensures consistent behavior across different messaging platforms.
 */
export interface MessageChannel {
  /** The type of channel (whatsapp, email, sms) */
  readonly channelType: 'whatsapp' | 'email' | 'sms';
  
  /**
   * Send a message through this channel
   * @param params - Message parameters
   * @returns Promise resolving to MessageResult
   */
  sendMessage(params: SendMessageParams): Promise<MessageResult>;
  
  /**
   * Validate if the channel is properly configured for a clinic
   * @param clinicId - Clinic ID to check
   * @returns Promise resolving to true if configured, false otherwise
   */
  validateConfig(clinicId: string): Promise<boolean>;
  
  /**
   * Get the channel configuration for a clinic
   * @param clinicId - Clinic ID
   * @returns Promise resolving to ChannelConfig or null if not found
   */
  getConfig(clinicId: string): Promise<ChannelConfig | null>;
}

/**
 * Channel types supported by the system
 */
export type ChannelType = 'whatsapp' | 'email' | 'sms';

/**
 * Channel registry interface
 */
export interface IChannelRegistry {
  /**
   * Register a new channel implementation
   * @param channel - Channel implementation to register
   */
  register(channel: MessageChannel): void;
  
  /**
   * Get a channel implementation by type
   * @param channelType - Type of channel to get
   * @returns Channel implementation or undefined if not found
   */
  get(channelType: ChannelType): MessageChannel | undefined;
  
  /**
   * Get all supported channel types
   * @returns Array of supported channel types
   */
  getSupportedChannels(): ChannelType[];
  
  /**
   * Check if a channel type is supported
   * @param channelType - Type to check
   * @returns True if supported, false otherwise
   */
  isSupported(channelType: ChannelType): boolean;
}
