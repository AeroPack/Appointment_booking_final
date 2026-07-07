-- Chatbot configuration per doctor
CREATE TABLE IF NOT EXISTS doctor_chatbot_config (
  doctor_id     UUID PRIMARY KEY REFERENCES users(id),
  is_enabled    BOOLEAN DEFAULT false,
  primary_color VARCHAR(7) DEFAULT '#3b82f6',
  greeting_msg  TEXT DEFAULT 'Hi! How can I help you today?',
  position      VARCHAR(20) DEFAULT 'bottom-right',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ entries per doctor
CREATE TABLE IF NOT EXISTS doctor_faq (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  UUID NOT NULL REFERENCES users(id),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  keywords   TEXT[] DEFAULT '{}',
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_faq_doctor_id ON doctor_faq(doctor_id);
