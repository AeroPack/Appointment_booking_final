-- Add appointment_type column to appointments table
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(20) DEFAULT 'checkup'
  CHECK (appointment_type IN ('checkup', 'consultation', 'followup', 'urgent', 'procedure'));
