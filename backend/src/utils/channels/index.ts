/**
 * Channel Abstraction Layer
 * 
 * This module provides a unified interface for sending messages across
 * different channels (WhatsApp, Email, SMS). It follows the Open/Closed
 * Principle - open for extension, closed for modification.
 * 
 * Usage:
 * ```typescript
 * import { channelRegistry, sendMessage } from './channels/index.js';
 * 
 * // Send a message via WhatsApp
 * await sendMessage({
 *   to: '+1234567890',
 *   content: 'Hello!',
 *   clinicId: 'clinic-uuid',
 *   channel: 'whatsapp'
 * });
 * ```
 */

// Export types
export type { 
  MessageChannel, 
  MessageResult, 
  SendMessageParams, 
  ChannelConfig,
  ChannelType,
  IChannelRegistry
} from './types.js';

// Export registry
export { ChannelRegistry, channelRegistry } from './registry.js';

// Export utility functions
export { sendMessage, validateChannelConfig } from './utils.js';

// Export initializer
export { initializeChannels, getChannelRegistry } from './initializer.js';
