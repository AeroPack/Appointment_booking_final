-- Migration: Add WhatsApp configuration to clinics table
-- This migration adds UltraMsg API configuration for WhatsApp messaging

ALTER TABLE clinics 
ADD COLUMN ultramsg_instance_id VARCHAR(50),
ADD COLUMN ultramsg_token VARCHAR(100),
ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN clinics.ultramsg_instance_id IS 'UltraMsg API instance ID for WhatsApp messaging';
COMMENT ON COLUMN clinics.ultramsg_token IS 'UltraMsg API authentication token';
COMMENT ON COLUMN clinics.whatsapp_enabled IS 'Whether WhatsApp messaging is enabled for this clinic';
