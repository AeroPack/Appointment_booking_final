import pg from 'pg';
// import { config } from 'dotenv';

// config();

const pool = new pg.Pool({
    connectionString : process.env.DATABASE_URL,
    max : Number(process.env.DB_MAX_CONNECTIONS) || 10,
    idleTimeoutMillis : Number(process.env.DB_IDLE_TIMEOUT) || 30000,
        ...(process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL === 'true' ? { ssl: {rejectUnauthorized: true} } : {}),
});
pool.on('error', (err: Error) => { 
    console.error('[DB] Unexpected error on idle client:', err.message);

    });


/**
 * Run a set of statements as one atomic unit.
 * Multi-step writes (creating a clinic and its doctor, say) must not leave a
 * half-finished account behind when a later step fails.
 * @param fn - Receives a dedicated client; every query in it shares one transaction
 * @returns Whatever fn returns, after COMMIT
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

    export default pool;
