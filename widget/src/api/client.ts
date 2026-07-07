import type { SlotsResponse, BookResponse, DoctorInfo, FaqResponse } from '../types';

export class ApiClient {
  private apiHost: string;
  private botApiKey: string;
  private doctorId: string;

  constructor(apiHost: string, botApiKey: string, doctorId: string) {
    this.apiHost = apiHost.replace(/\/$/, '');
    this.botApiKey = botApiKey;
    this.doctorId = doctorId;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiHost}/api${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Key': this.botApiKey,
        ...options.headers,
      },
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'API request failed');
    }
    return data.data;
  }

  async getSlots(from: string, to?: string): Promise<SlotsResponse> {
    const params = new URLSearchParams({ doctor_id: this.doctorId, from });
    if (to) params.set('to', to);
    return this.request<SlotsResponse>(`/bot/slots?${params}`);
  }

  async bookAppointment(data: {
    patient_name: string;
    patient_phone: string;
    slot_start: string;
    reason?: string;
  }): Promise<BookResponse> {
    return this.request<BookResponse>('/bot/book', {
      method: 'POST',
      body: JSON.stringify({ ...data, doctor_id: this.doctorId }),
    });
  }

  async getDoctorInfo(): Promise<DoctorInfo> {
    return this.request<DoctorInfo>(`/bot/doctor/${this.doctorId}`);
  }

  async searchFaq(query: string): Promise<FaqResponse> {
    const params = new URLSearchParams({ doctor_id: this.doctorId, query });
    return this.request<FaqResponse>(`/bot/faq?${params}`);
  }
}
