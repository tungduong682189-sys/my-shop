require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('Thiếu biến môi trường: DATABASE_URL');
  process.exit(1);
}

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, slug, parent_id FROM categories ORDER BY sort_order, id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.slug, p.price, p.stock, p.image_url,
              c.name AS category
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = true
       ORDER BY p.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

app.listen(PORT, () => {
  console.log(`Cửa hàng chạy tại http://localhost:${PORT}`);
});