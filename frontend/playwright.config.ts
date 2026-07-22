import { defineConfig } from '@playwright/test';

// Assumes the backend (npm run dev, backend/) and frontend (npm run dev, frontend/)
// dev servers are already running against a migrated + seeded database, with the
// shared booking flow seeded via `npm run seed:shared-flow` (backend/).
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
  },
});
