/**
 * Channel Initializer
 * 
 * Initializes and registers all available message channels.
 * This module should be imported once at application startup.
 */

import { channelRegistry } from './registry.js';
import { WhatsAppChannel } from './whatsapp.js';
import { WhatsAppCloudChannel } from './whatsapp-cloud.js';
import { WhatsAppEvolutionChannel } from './whatsapp-evolution.js';

/**
 * Initialize all message channels
 *
 * This function registers all available channel implementations
 * with the channel registry. It should be called once at application startup.
 */
export function initializeChannels(): void {
  console.log('[ChannelInitializer] Initializing message channels...');

  const provider = process.env['WA_PROVIDER'] || 'evolution';
  let whatsappChannel;
  switch (provider) {
    case 'cloud':
      whatsappChannel = new WhatsAppCloudChannel();
      break;
    case 'evolution':
      whatsappChannel = new WhatsAppEvolutionChannel();
      break;
    default:
      whatsappChannel = new WhatsAppChannel();
      break;
  }
  channelRegistry.register(whatsappChannel);
  console.log(`[ChannelInitializer] WhatsApp provider: ${provider}`);

  // Future channels can be registered here:
  // const emailChannel = new EmailChannel();
  // channelRegistry.register(emailChannel);
  
  // const smsChannel = new SMSChannel();
  // channelRegistry.register(smsChannel);
  
  console.log('[ChannelInitializer] Initialized channels:', channelRegistry.getSupportedChannels());
}

/**
 * Get the initialized channel registry
 * @returns The channel registry instance
 */
export function getChannelRegistry() {
  return channelRegistry;
}
