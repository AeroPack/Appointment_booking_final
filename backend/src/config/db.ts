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


    export default pool;
