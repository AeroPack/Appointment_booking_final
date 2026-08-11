/**
 * Channel Initializer
 * 
 * Initializes and registers all available message channels.
 * This module should be imported once at application startup.
 */

import { channelRegistry } from './registry.js';
import { WhatsAppChannel } from './whatsapp.js';
import { WhatsAppCloudChannel } from './whatsapp-cloud.js';

/**
 * Initialize all message channels
 *
 * This function registers all available channel implementations
 * with the channel registry. It should be called once at application startup.
 */
export function initializeChannels(): void {
  console.log('[ChannelInitializer] Initializing message channels...');

  // ponytail: temporary cutover switch. The Cloud API is the target provider -
  // it is the only one that can send the booking flow's buttons and slot list -
  // but OTP keeps working on the already-approved BhashSMS `aero_auth` template
  // until its Cloud API equivalent clears review. Delete this switch, the
  // default, and whatsapp.ts once cutover is verified.
  const provider = process.env['WA_PROVIDER'] || 'bhashsms';
  const whatsappChannel =
    provider === 'cloud' ? new WhatsAppCloudChannel() : new WhatsAppChannel();
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
