import { beforeAll, afterEach, afterAll } from '@jest/globals';
import pg from 'pg';
import { resetRateLimiter } from '../middleware/rateLimit.js';
import appPool from '../config/db.js';

const TRUNCATE_TABLES = [
  'messages',
  'message_templates',
  'user_tags',
  'tags',
  'appointment_status_history',
  'appointments',
  'appointment_settings',
  'venues',
  'doctor_profiles',
  'refresh_tokens',
  'otps',
  'users',
  'clinics',
];

let pool;

async function truncateAll() {
  for (const table of TRUNCATE_TABLES) {
    await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
  }
}

beforeAll(async () => {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });
});

afterEach(async () => {
  resetRateLimiter();
  if (pool) {
    await truncateAll();
  }
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
  await appPool.end();
});
