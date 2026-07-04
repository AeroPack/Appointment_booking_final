import { DashboardRepository } from './dashboard.repository.js';
import type { VenueTypeStat } from './dashboard.types.js';

export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  async getStats(doctorId: string, from: string, to: string) {
    return this.repo.findStats(doctorId, from, to);
  }

  async getPatients(doctorId: string, from: string, to: string) {
    return this.repo.findPatients(doctorId, from, to);
  }

  async getVenueTypeStats(doctorId: string, from: string, to: string): Promise<VenueTypeStat[]> {
    const rows = await this.repo.findVenueTypeStats(doctorId, from, to);

    const venueMap = new Map<string, VenueTypeStat>();

    for (const row of rows) {
      let venue = venueMap.get(row.venue_id);
      if (!venue) {
        venue = {
          venue_id: row.venue_id,
          venue_name: row.venue_name,
          types: [],
          total: 0,
        };
        venueMap.set(row.venue_id, venue);
      }
      venue.types.push({ type: row.appointment_type, count: row.count });
      venue.total += row.count;
    }

    return Array.from(venueMap.values());
  }
}
