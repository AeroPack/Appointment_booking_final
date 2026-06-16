import { runner } from 'node-pg-migrate';
import pool from '../config/db.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  const client = await pool.connect();
  try {
    await runner({
      dbClient: client,
      dir: resolve(__dirname, '../../migrations'),
      migrationsTable: 'schema_migrations',
      direction: 'up',
      count: Infinity,
    });
    console.log('Migrations applied successfully');
  } finally {
    client.release();
  }
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
