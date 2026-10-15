require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Thiếu biến môi trường: DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    await pool.query(sql);
    console.log('Đã chạy', file);
  }
  await pool.end();
  console.log('Xong! Database đã sẵn sàng.');
}

run().catch(err => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});