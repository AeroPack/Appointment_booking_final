import pool from './src/config/db.js';

async function listUsers() {
  try {
    const result = await pool.query("SELECT name, email, mobile_number FROM users LIMIT 5;");
    console.log('Sample users:', result.rows);
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await pool.end();
  }
}

listUsers();
