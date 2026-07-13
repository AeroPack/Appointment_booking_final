/**
 * Configuration Fallback Test
 * 
 * Tests the complete configuration fallback chain:
 * 1. Clinic DB config (highest priority)
 * 2. ULTRAMSG_* env vars
 * 3. APP_WHATSAPP_* env vars (lowest priority)
 */

import { initializeChannels, channelRegistry } from './utils/channels/index.js';

async function testConfigFallback() {
  console.log('Testing Configuration Fallback Chain...\n');
  
  initializeChannels();
  
  const whatsappChannel = channelRegistry.get('whatsapp');
  if (!whatsappChannel) {
    console.error('❌ WhatsApp channel not registered');
    return;
  }
  
  // Test with non-existent clinic (should use env var fallback)
  console.log('1. Testing with non-existent clinic (env var fallback)...');
  const config = await whatsappChannel.getConfig('00000000-0000-0000-0000-000000000000');
  
  if (config) {
    console.log('   ✅ Config found via fallback');
    console.log(`   - Enabled: ${config.enabled}`);
    console.log(`   - Instance ID: ${config.instanceId}`);
    console.log(`   - Uses app config: ${config.instanceId === process.env['APP_WHATSAPP_INSTANCE_ID']}`);
  } else {
    console.log('   ❌ No config found');
  }
  
  // Check which env vars are being used
  console.log('\n2. Environment variable check:');
  console.log(`   ULTRAMSG_INSTANCE_ID: ${process.env['ULTRAMSG_INSTANCE_ID'] || 'Not set'}`);
  console.log(`   ULTRAMSG_TOKEN: ${process.env['ULTRAMSG_TOKEN'] ? 'Set' : 'Not set'}`);
  console.log(`   APP_WHATSAPP_INSTANCE_ID: ${process.env['APP_WHATSAPP_INSTANCE_ID'] || 'Not set'}`);
  console.log(`   APP_WHATSAPP_TOKEN: ${process.env['APP_WHATSAPP_TOKEN'] ? 'Set' : 'Not set'}`);
  console.log(`   APP_WHATSAPP_ENABLED: ${process.env['APP_WHATSAPP_ENABLED'] || 'Not set'}`);
  
  console.log('\n✅ Configuration fallback test completed');
}

testConfigFallback().catch(console.error);
