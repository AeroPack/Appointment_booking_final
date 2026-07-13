-- Migration: Add clinical_notes column to appointments table
-- Separate from the existing 'notes' column which stores the booking reason

ALTER TABLE appointments ADD COLUMN clinical_notes TEXT;

COMMENT ON COLUMN appointments.clinical_notes IS 'Doctor clinical notes, separate from booking reason stored in notes';
