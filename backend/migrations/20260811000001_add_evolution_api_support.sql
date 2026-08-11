-- Evolution API support for per-doctor WhatsApp chatbot instances
ALTER TABLE doctor_chatbot_config
  ADD COLUMN IF NOT EXISTS evolution_instance_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS evolution_connection_status VARCHAR(20) DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS evolution_connected_at TIMESTAMPTZ;

-- Each Evolution instance maps to exactly one doctor
CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_chatbot_config_evolution_instance
  ON doctor_chatbot_config(evolution_instance_name)
  WHERE evolution_instance_name IS NOT NULL;

-- Evolution API base URL per clinic
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS evolution_api_url VARCHAR(255);
