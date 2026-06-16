export interface TagRow {
  id: string;
  clinic_id: string;
  name: string;
  color: string | null;
  is_system: boolean;
  is_auto: boolean;
  rule_definition: Record<string, unknown> | null;
}

export interface UserTagRow {
  user_id: string;
  tag_id: string;
  assigned_by: string | null;
  assigned_at: Date;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  is_auto?: boolean;
  rule_definition?: Record<string, unknown>;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
  rule_definition?: Record<string, unknown>;
}
