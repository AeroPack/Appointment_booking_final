import pool from './src/config/db.js';

async function checkUser() {
  try {
    const result = await pool.query(
      "SELECT name, email, mobile_number FROM users WHERE email = 'wings.recr@gmail.com' OR mobile_number = '9876543210';"
    );
    console.log('User search result:', result.rows);
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await pool.end();
  }
}

checkUser();
