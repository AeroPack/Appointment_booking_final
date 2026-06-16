export interface UpdateProfileInput {
  name?: string;
  email?: string;
  address?: string;
  date_of_birth?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

export interface CreateDependentInput {
  name: string;
  mobile_number?: string;
  whatsapp_number?: string;
  email?: string;
  address?: string;
  relationship?: string;
  date_of_birth?: string;
}
