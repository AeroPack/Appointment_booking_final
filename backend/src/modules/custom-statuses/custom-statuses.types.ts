export interface CustomStatusRow {
  id: string;
  clinic_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_system: boolean;
}

export interface CreateCustomStatusInput {
  name: string;
  color?: string;
  sort_order?: number;
}

export interface UpdateCustomStatusInput {
  name?: string;
  color?: string | null;
  sort_order?: number;
}
