import type { SlotsResponse, BookResponse, DoctorInfo, FaqResponse } from '../types';

export class ApiClient {
  private apiHost: string;
  private widgetKey: string;

  constructor(apiHost: string, widgetKey: string) {
    this.apiHost = apiHost.replace(/\/$/, '');
    this.widgetKey = widgetKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiHost}/api${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Widget-Key': this.widgetKey,
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
    const params = new URLSearchParams({ from });
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
      body: JSON.stringify(data),
    });
  }

  async getDoctorInfo(): Promise<DoctorInfo> {
    return this.request<DoctorInfo>('/bot/doctor');
  }

  async searchFaq(query: string): Promise<FaqResponse> {
    const params = new URLSearchParams({ query });
    return this.request<FaqResponse>(`/bot/faq?${params}`);
  }
}
