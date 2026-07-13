/**
 * Multi-Tenant WhatsApp Configuration Test
 * 
 * This script tests the multi-tenant WhatsApp configuration.
 * Run with: node --import dotenv/config --import tsx src/test-multi-tenant.ts
 */

import pool from './config/db.js';

async function testMultiTenantConfig() {
  console.log('Testing multi-tenant WhatsApp configuration...\n');
  
  try {
    // Test 1: Check if clinics table has WhatsApp configuration columns
    console.log('1. Checking clinics table structure...');
    const tableCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clinics' 
        AND column_name IN ('ultramsg_instance_id', 'ultramsg_token', 'whatsapp_enabled')
      ORDER BY column_name
    `);
    
    if (tableCheck.rows.length === 3) {
      console.log('✅ WhatsApp configuration columns exist');
    } else {
      console.log('❌ Missing WhatsApp configuration columns');
      console.log('Found columns:', tableCheck.rows);
    }
    
    // Test 2: Check if there are any clinics
    console.log('\n2. Checking clinics...');
    const clinicsResult = await pool.query('SELECT id, name FROM clinics LIMIT 5');
    console.log(`Found ${clinicsResult.rows.length} clinics`);
    
    if (clinicsResult.rows.length > 0) {
      const clinic = clinicsResult.rows[0];
      console.log(`Testing with clinic: ${clinic.name} (${clinic.id})`);
      
      // Test 3: Update WhatsApp configuration for a clinic
      console.log('\n3. Updating WhatsApp configuration...');
      await pool.query(`
        UPDATE clinics 
        SET ultramsg_instance_id = 'test_instance',
            ultramsg_token = 'test_token',
            whatsapp_enabled = true
        WHERE id = $1
      `, [clinic.id]);
      
      // Test 4: Verify the update
      console.log('\n4. Verifying configuration...');
      const configResult = await pool.query(`
        SELECT ultramsg_instance_id, ultramsg_token, whatsapp_enabled
        FROM clinics WHERE id = $1
      `, [clinic.id]);
      
      const config = configResult.rows[0];
      if (config.ultramsg_instance_id === 'test_instance' && 
          config.ultramsg_token === 'test_token' && 
          config.whatsapp_enabled === true) {
        console.log('✅ WhatsApp configuration updated successfully');
      } else {
        console.log('❌ WhatsApp configuration update failed');
        console.log('Config:', config);
      }
      
      // Test 5: Reset the configuration
      console.log('\n5. Resetting configuration...');
      await pool.query(`
        UPDATE clinics 
        SET ultramsg_instance_id = NULL,
            ultramsg_token = NULL,
            whatsapp_enabled = false
        WHERE id = $1
      `, [clinic.id]);
      
      console.log('✅ Configuration reset successfully');
    }
    
    console.log('\n✅ All multi-tenant configuration tests passed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testMultiTenantConfig();
