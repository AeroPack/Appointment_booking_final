/**
 * UltraMsg API Test Script
 * 
 * This script tests the UltraMsg API connection with the provided credentials.
 * Run with: node --import dotenv/config --import tsx src/test-ultramsg.ts
 */
//ss

import axios from 'axios';

const config = {
  instanceId: process.env['ULTRAMSG_INSTANCE_ID'] || 'instance184349',
  token: process.env['ULTRAMSG_TOKEN'] || '8q7zgiw966oq3713',
  apiUrl: process.env['ULTRAMSG_API_URL'] || 'https://api.ultramsg.com/instance184349',
};

async function testConnection() {
  console.log('Testing UltraMsg API connection...');
  console.log('Instance ID:', config.instanceId);
  console.log('API URL:', config.apiUrl);
  
  try {
    // Test 1: Check instance settings
    console.log('\n1. Testing instance settings...');
    const settingsUrl = `${config.apiUrl}/instance/settings`;
    const settingsData = new URLSearchParams();
    settingsData.append('token', config.token);
    
    const settingsResponse = await axios.post(settingsUrl, settingsData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    console.log('Settings response:', settingsResponse.data);
    
    // Test 2: Send a test message (to yourself for testing)
    console.log('\n2. Testing message sending...');
    const messageUrl = `${config.apiUrl}/messages/chat`;
    const messageData = new URLSearchParams();
    messageData.append('token', config.token);
    messageData.append('to', '+1234567890'); // Replace with your phone number
    messageData.append('body', 'Test message from UltraMsg API integration');
    
    const messageResponse = await axios.post(messageUrl, messageData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    console.log('Message response:', messageResponse.data);
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
    }
  }
}

testConnection();
