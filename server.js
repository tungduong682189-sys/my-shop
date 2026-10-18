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

// Danh sách danh mục
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

// Danh sách sản phẩm: lọc, tìm kiếm, sắp xếp, phân trang
app.get('/api/products', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const q = String(req.query.q || '').trim().slice(0, 100);
  const category = String(req.query.category || '').trim().slice(0, 100);

  // Chỉ cho phép các kiểu sắp xếp có sẵn, không ghép chuỗi người dùng vào SQL
  const ORDERS = {
    newest: 'p.id DESC',
    price_asc: 'p.price ASC, p.id DESC',
    price_desc: 'p.price DESC, p.id DESC'
  };
  const sort = String(req.query.sort || '');
  const orderBy = Object.hasOwn(ORDERS, sort) ? ORDERS[sort] : ORDERS.newest;

  const where = ['p.is_active = true'];
  const params = [];

  if (q) {
    // Chặn các ký tự đặc biệt của LIKE (% _ \) để tìm đúng chữ người dùng gõ
    params.push('%' + q.replace(/[\\%_]/g, '\\$&') + '%');
    where.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
  }

  if (category) {
    // Chọn danh mục cha thì lấy luôn sản phẩm của danh mục con
    params.push(category);
    where.push(
      `(c.slug = $${params.length} OR c.parent_id = (SELECT id FROM categories WHERE slug = $${params.length}))`
    );
  }

  const whereSql = where.join(' AND ');
  const fromSql = `FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`;

  try {
    const countResult = await pool.query(`SELECT COUNT(*)::int AS total ${fromSql}`, params);
    const total = countResult.rows[0].total;

    const listParams = [...params, limit, (page - 1) * limit];
    const items = await pool.query(
      `SELECT p.id, p.name, p.slug, p.price, p.stock, p.image_url,
              c.name AS category, c.slug AS category_slug
       ${fromSql}
       ORDER BY ${orderBy}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    res.json({
      items: items.rows,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

app.listen(PORT, () => {
  console.log(`Cửa hàng chạy tại http://localhost:${PORT}`);
});