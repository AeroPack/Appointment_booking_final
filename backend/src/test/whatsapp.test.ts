/**
 * WhatsApp Integration Test
 * 
 * This file contains basic tests for the WhatsApp integration.
 * It verifies that the channel abstraction layer works correctly.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { initializeChannels, channelRegistry } from '../utils/channels/index.js';
import { WhatsAppChannel } from '../utils/channels/whatsapp.js';

describe('WhatsApp Integration', () => {
  beforeAll(() => {
    initializeChannels();
  });

  it('should register WhatsApp channel', () => {
    expect(channelRegistry.isSupported('whatsapp')).toBe(true);
  });

  it('should get WhatsApp channel instance', () => {
    const channel = channelRegistry.get('whatsapp');
    expect(channel).toBeDefined();
    expect(channel).toBeInstanceOf(WhatsAppChannel);
  });

  it('should have correct channel type', () => {
    const channel = channelRegistry.get('whatsapp') as WhatsAppChannel;
    expect(channel.channelType).toBe('whatsapp');
  });

  it('should list supported channels', () => {
    const channels = channelRegistry.getSupportedChannels();
    expect(channels).toContain('whatsapp');
  });
});
