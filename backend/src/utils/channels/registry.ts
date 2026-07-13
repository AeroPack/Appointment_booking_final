/**
 * Channel Registry Implementation
 * 
 * Manages message channel implementations and provides a unified interface
 * for accessing different messaging platforms.
 */

import type { MessageChannel, ChannelType, IChannelRegistry } from './types.js';

/**
 * Registry for managing message channel implementations
 * 
 * This class follows the Registry pattern to manage different messaging
 * channels (WhatsApp, Email, SMS). It allows dynamic registration and
 * retrieval of channel implementations.
 */
export class ChannelRegistry implements IChannelRegistry {
  private channels: Map<ChannelType, MessageChannel> = new Map();

  /**
   * Register a new channel implementation
   * @param channel - Channel implementation to register
   * @throws Error if channel type is already registered
   */
  register(channel: MessageChannel): void {
    const { channelType } = channel;
    
    if (this.channels.has(channelType)) {
      throw new Error(`Channel type '${channelType}' is already registered`);
    }
    
    this.channels.set(channelType, channel);
    console.log(`[ChannelRegistry] Registered channel: ${channelType}`);
  }

  /**
   * Get a channel implementation by type
   * @param channelType - Type of channel to get
   * @returns Channel implementation or undefined if not found
   */
  get(channelType: ChannelType): MessageChannel | undefined {
    return this.channels.get(channelType);
  }

  /**
   * Get all supported channel types
   * @returns Array of supported channel types
   */
  getSupportedChannels(): ChannelType[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Check if a channel type is supported
   * @param channelType - Type to check
   * @returns True if supported, false otherwise
   */
  isSupported(channelType: ChannelType): boolean {
    return this.channels.has(channelType);
  }

  /**
   * Get all registered channel implementations
   * @returns Array of channel implementations
   */
  getAllChannels(): MessageChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get channel implementation or throw error if not found
   * @param channelType - Type of channel to get
   * @returns Channel implementation
   * @throws Error if channel type is not registered
   */
  getOrThrow(channelType: ChannelType): MessageChannel {
    const channel = this.channels.get(channelType);
    if (!channel) {
      throw new Error(`Channel type '${channelType}' is not registered`);
    }
    return channel;
  }
}

/**
 * Singleton instance of the channel registry
 */
export const channelRegistry = new ChannelRegistry();

