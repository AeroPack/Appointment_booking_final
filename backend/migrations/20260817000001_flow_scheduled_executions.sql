CREATE TABLE IF NOT EXISTS flow_scheduled_executions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES flow_sessions(id) ON DELETE CASCADE,
  flow_id        UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  flow_version_id UUID NOT NULL REFERENCES flow_versions(id) ON DELETE CASCADE,
  doctor_id      UUID NOT NULL REFERENCES users(id),
  patient_id     UUID REFERENCES users(id),
  appointment_id UUID REFERENCES appointments(id),
  current_node_id TEXT NOT NULL,
  context        JSONB NOT NULL DEFAULT '{}',
  execute_at     TIMESTAMPTZ NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'executed', 'cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_scheduled_execute_at
  ON flow_scheduled_executions (execute_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_flow_scheduled_appointment
  ON flow_scheduled_executions (appointment_id)
  WHERE status = 'pending';
