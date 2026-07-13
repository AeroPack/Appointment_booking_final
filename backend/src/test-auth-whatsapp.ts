/**
 * Auth WhatsApp OTP Test Script
 * 
 * This script tests the WhatsApp OTP sending functionality for authentication.
 * Run with: node --import dotenv/config --import tsx src/test-auth-whatsapp.ts
 */

import { initializeChannels, channelRegistry } from './utils/channels/index.js';
import { WhatsAppChannel } from './utils/channels/whatsapp.js';

async function testAuthWhatsApp() {
  console.log('Testing Auth WhatsApp OTP functionality...\n');
  
  // Initialize channels
  initializeChannels();
  
  // Check if WhatsApp channel is registered
  const whatsappChannel = channelRegistry.get('whatsapp');
  if (!whatsappChannel) {
    console.error('❌ WhatsApp channel not registered');
    return;
  }
  
  console.log('✅ WhatsApp channel registered');
  
  // Test 1: Check app-level config fallback
  console.log('\n1. Testing app-level config fallback...');
  const appInstanceId = process.env['APP_WHATSAPP_INSTANCE_ID'];
  const appToken = process.env['APP_WHATSAPP_TOKEN'];
  const appEnabled = process.env['APP_WHATSAPP_ENABLED'];
  
  console.log(`   APP_WHATSAPP_INSTANCE_ID: ${appInstanceId ? '✓ Set' : '✗ Not set'}`);
  console.log(`   APP_WHATSAPP_TOKEN: ${appToken ? '✓ Set' : '✗ Not set'}`);
  console.log(`   APP_WHATSAPP_ENABLED: ${appEnabled}`);
  
  // Test 2: Check channel config for a test clinic
  console.log('\n2. Testing channel configuration...');
  const testClinicId = 'test-clinic-id';
  
  try {
    const config = await whatsappChannel.getConfig(testClinicId);
    if (config) {
      console.log('   ✅ Config found');
      console.log(`   - Enabled: ${config.enabled}`);
      console.log(`   - Instance ID: ${config.instanceId ? '✓ Set' : '✗ Not set'}`);
      console.log(`   - Token: ${config.token ? '✓ Set' : '✗ Not set'}`);
    } else {
      console.log('   ⚠️  No config found (using defaults)');
    }
  } catch (error) {
    console.log('   ⚠️  Config fetch failed (using defaults):', error);
  }
  
  // Test 3: Send a test OTP message
  console.log('\n3. Testing OTP message sending...');
  
  // Replace with your actual phone number for testing
  const testPhoneNumber = '+1234567890'; // Change this to your number
  
  console.log(`   Sending test OTP to: ${testPhoneNumber}`);
  
  try {
    const result = await whatsappChannel.sendMessage({
      to: testPhoneNumber,
      content: 'Test OTP: 123456. This is a test message from the auth system.',
      clinicId: testClinicId,
      options: { type: 'auth_otp', test: true },
    });
    
    if (result.success) {
      console.log('   ✅ OTP message sent successfully');
      console.log(`   - Message ID: ${result.messageId}`);
    } else {
      console.log('   ❌ Failed to send OTP message');
      console.log(`   - Error: ${result.error}`);
    }
  } catch (error) {
    console.log('   ❌ Error sending OTP message:', error);
  }
  
  console.log('\n✅ Auth WhatsApp OTP test completed');
}

testAuthWhatsApp().catch(console.error);
