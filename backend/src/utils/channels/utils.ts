/**
 * Channel Utility Functions
 * 
 * Helper functions for working with message channels.
 */

import type { ChannelType, MessageResult } from './types.js';
import { channelRegistry } from './registry.js';

/**
 * Send a message through the specified channel
 * @param params - Message parameters including channel type
 * @returns Promise resolving to MessageResult
 * @throws Error if channel is not supported
 */
export async function sendMessage(params: {
  to: string;
  content: string;
  clinicId: string;
  channel: ChannelType;
  options?: Record<string, unknown>;
}): Promise<MessageResult> {
  const { channel: channelType, ...messageParams } = params;
  
  const channel = channelRegistry.get(channelType);
  if (!channel) {
    throw new Error(`Channel '${channelType}' is not supported`);
  }
  
  return channel.sendMessage(messageParams);
}

/**
 * Validate if a channel is properly configured for a clinic
 * @param clinicId - Clinic ID to check
 * @param channelType - Channel type to validate
 * @returns Promise resolving to true if configured, false otherwise
 */
export async function validateChannelConfig(
  clinicId: string, 
  channelType: ChannelType
): Promise<boolean> {
  const channel = channelRegistry.get(channelType);
  if (!channel) {
    return false;
  }
  
  return channel.validateConfig(clinicId);
}

/**
 * Get a successful message result
 * @param messageId - Optional message ID from provider
 * @param metadata - Optional metadata
 * @returns MessageResult with success=true
 */
export function createSuccessResult(
  messageId?: string,
  metadata?: Record<string, unknown>
): MessageResult {
  return {
    success: true,
    messageId,
    timestamp: new Date(),
    metadata,
  };
}

/**
 * Get a failed message result
 * @param error - Error message
 * @param metadata - Optional metadata
 * @returns MessageResult with success=false
 */
export function createErrorResult(
  error: string,
  metadata?: Record<string, unknown>
): MessageResult {
  return {
    success: false,
    error,
    timestamp: new Date(),
    metadata,
  };
}
