-- Up Migration
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(20);

-- Down Migration
ALTER TABLE users
  DROP COLUMN IF EXISTS whatsapp_number,
  DROP COLUMN IF EXISTS date_of_birth;
