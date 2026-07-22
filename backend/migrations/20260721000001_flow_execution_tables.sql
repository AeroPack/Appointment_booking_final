-- flows/flow_versions are created by 20260718000001_add_booking_flows.

-- Allow a "shared" flow (doctor_id IS NULL) that serves every doctor for a
-- given trigger type, alongside optional future per-doctor overrides.
ALTER TABLE flows ALTER COLUMN doctor_id DROP NOT NULL;

-- uq_flows_doctor_trigger_active does not dedupe NULLs, so a separate index
-- is needed to guarantee at most one active shared flow per trigger type.
CREATE UNIQUE INDEX IF NOT EXISTS uq_flows_shared_trigger_active
  ON flows(trigger_type) WHERE doctor_id IS NULL AND is_active;

-- Execution state for a running flow conversation.
CREATE TABLE IF NOT EXISTS flow_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id             UUID NOT NULL REFERENCES flows(id),
  flow_version_id     UUID NOT NULL REFERENCES flow_versions(id),
  doctor_id           UUID NOT NULL REFERENCES users(id),
  patient_id          UUID REFERENCES users(id),
  channel             VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'web')),
  channel_session_id  TEXT NOT NULL,
  current_node_id     TEXT,
  context             JSONB NOT NULL DEFAULT '{}',
  status              VARCHAR(20) NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'running', 'waiting_input', 'completed', 'error', 'expired')),
  error_message       TEXT,
  step_count          INTEGER NOT NULL DEFAULT 0,
  started_at          TIMESTAMPTZ,
  last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_sessions_doctor_channel_status
  ON flow_sessions(doctor_id, channel_session_id, status);
CREATE INDEX IF NOT EXISTS idx_flow_sessions_patient_id ON flow_sessions(patient_id);

-- Individual chat turns within a flow_session.
CREATE TABLE IF NOT EXISTS flow_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES flow_sessions(id),
  direction           VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  node_id             TEXT,
  content             TEXT NOT NULL,
  message_type        VARCHAR(20) NOT NULL
    CHECK (message_type IN ('text', 'choice', 'api_request', 'api_response', 'system')),
  channel_message_id  TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_messages_session_created ON flow_messages(session_id, created_at);
