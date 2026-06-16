import { DashboardRepository } from './dashboard.repository.js';

export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  async getStats(doctorId: string, date?: string) {
    const dateStr = date || this.todayIST();
    return this.repo.findStats(doctorId, dateStr);
  }

  async getTodayPatients(doctorId: string, date?: string) {
    const dateStr = date || this.todayIST();
    return this.repo.findTodayPatients(doctorId, dateStr);
  }

  private todayIST(): string {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
  }
}
