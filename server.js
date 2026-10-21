require('dotenv').config();

const missing = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY']
  .filter(k => !process.env[k]);
if (missing.length) {
  console.error('Thiếu biến môi trường:', missing.join(', '));
  process.exit(1);
}

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.set('trust proxy', 1); // để lấy đúng địa chỉ IP khi chạy sau Render
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

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

// Chi tiết một sản phẩm (kèm danh mục cha và sản phẩm liên quan)
app.get('/api/products/:slug', async (req, res) => {
  const slug = String(req.params.slug || '').slice(0, 200);
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.slug, p.description, p.price, p.stock, p.image_url,
              p.category_id,
              c.name AS category, c.slug AS category_slug,
              pc.name AS parent_name, pc.slug AS parent_slug
       FROM products p
       LEFT JOIN categories c  ON c.id  = p.category_id
       LEFT JOIN categories pc ON pc.id = c.parent_id
       WHERE p.slug = $1 AND p.is_active = true`,
      [slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    }
    const product = result.rows[0];

    let related = [];
    if (product.category_id) {
      const rel = await pool.query(
        `SELECT p.id, p.name, p.slug, p.price, p.stock, p.image_url,
                c.name AS category
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = true AND p.category_id = $1 AND p.id <> $2
         ORDER BY p.id DESC
         LIMIT 4`,
        [product.category_id, product.id]
      );
      related = rel.rows;
    }

    res.json({ product, related });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Trang chi tiết: mọi địa chỉ dạng /san-pham/ten-san-pham đều dùng chung một file
app.get('/san-pham/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

/* ===================== ĐẶT HÀNG ===================== */

// Chuẩn hóa giỏ hàng gửi lên: chỉ nhận mã và số lượng hợp lệ, gộp dòng trùng
function cartMap(raw) {
  const list = Array.isArray(raw) ? raw.slice(0, 50) : [];
  const map = new Map();
  for (const it of list) {
    const id = Number(it && it.id);
    const quantity = Number(it && it.quantity);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;
    map.set(id, Math.min(99, (map.get(id) || 0) + quantity));
  }
  return map;
}

// Số điện thoại Việt Nam: 10 số bắt đầu bằng 0 (chấp nhận +84)
function normalizePhone(value) {
  let s = String(value || '').replace(/[\s.\-()]/g, '');
  if (s.startsWith('+84')) s = '0' + s.slice(3);
  return /^0\d{9}$/.test(s) ? s : null;
}

// Giới hạn số đơn mỗi địa chỉ IP (lưu trong bộ nhớ)
const orderHits = new Map();
const ORDER_WINDOW_MS = 10 * 60 * 1000;
const ORDER_MAX = 5;

function orderRateLimited(ip) {
  const now = Date.now();
  const hits = (orderHits.get(ip) || []).filter(t => now - t < ORDER_WINDOW_MS);
  if (hits.length >= ORDER_MAX) {
    orderHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  orderHits.set(ip, hits);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of orderHits) {
    const recent = hits.filter(t => now - t < ORDER_WINDOW_MS);
    if (recent.length) orderHits.set(ip, recent);
    else orderHits.delete(ip);
  }
}, ORDER_WINDOW_MS).unref();

// Tạo đơn hàng
app.post('/api/orders', async (req, res) => {
  const body = req.body || {};

  const name = String(body.customer_name || '').trim();
  const phone = normalizePhone(body.phone);
  const address = String(body.address || '').trim();
  const note = String(body.note || '').trim().slice(0, 500);
  const payment = String(body.payment_method || 'cod');

  if (name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'Vui lòng nhập họ tên (2 đến 100 ký tự)', field: 'customer_name' });
  }
  if (!phone) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0)', field: 'phone' });
  }
  if (address.length < 10 || address.length > 300) {
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ đầy đủ (số nhà, đường, phường/xã, quận/huyện, tỉnh/thành)', field: 'address' });
  }
  if (payment !== 'cod') {
    return res.status(400).json({ error: 'Hình thức thanh toán không hợp lệ' });
  }

  const wanted = cartMap(body.items);
  if (wanted.size === 0) {
    return res.status(400).json({ error: 'Giỏ hàng đang trống' });
  }

  if (orderRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Bạn đặt hàng quá nhanh. Hãy thử lại sau ít phút.' });
  }
  
  const user = await userFromRequest(req);
  const userId = user ? user.id : null;
  const ids = [...wanted.keys()].sort((a, b) => a - b);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Khóa các dòng sản phẩm đang mua (sắp theo mã để tránh khóa chéo nhau)
    const found = await client.query(
      `SELECT id, name, price, stock FROM products
       WHERE id = ANY($1::int[]) AND is_active = true
       ORDER BY id
       FOR UPDATE`,
      [ids]
    );
    const byId = new Map(found.rows.map(r => [r.id, r]));

    const lines = [];
    const problems = [];
    let total = 0;
    for (const id of ids) {
      const p = byId.get(id);
      const qty = wanted.get(id);
      if (!p) {
        problems.push('một sản phẩm không còn bán');
      } else if (p.stock < qty) {
        problems.push(`"${p.name}" chỉ còn ${p.stock} sản phẩm`);
      } else {
        lines.push({ id, name: p.name, price: p.price, quantity: qty });
        total += p.price * qty;
      }
    }

    if (problems.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'stock',
        message: 'Giỏ hàng đã thay đổi: ' + problems.join('; ') + '. Vui lòng kiểm tra lại.'
      });
    }

    if (total > 2000000000) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Giá trị đơn hàng quá lớn' });
    }

    // Nếu tổng tiền khách đang thấy khác tổng thật thì báo lại, không tự đặt
    const expected = Number(body.expected_total);
    if (Number.isInteger(expected) && expected !== total) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'price',
        message: 'Giá hoặc tổng tiền đã thay đổi. Vui lòng kiểm tra lại rồi đặt hàng.'
      });
    }

    // Trừ kho
    await client.query(
      `UPDATE products p SET stock = p.stock - v.qty
       FROM unnest($1::int[], $2::int[]) AS v(id, qty)
       WHERE p.id = v.id`,
      [lines.map(l => l.id), lines.map(l => l.quantity)]
    );

    // Tạo đơn và các dòng hàng
    const code = 'DH-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const order = await client.query(
      `INSERT INTO orders (code, user_id, customer_name, phone, address, note, total, payment_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'cod')
        RETURNING id, code`,
      [code, userId, name, phone, address, note, total]
    );
    await client.query(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity)
       SELECT $1, v.pid, v.name, v.price, v.qty
       FROM unnest($2::int[], $3::text[], $4::int[], $5::int[]) AS v(pid, name, price, qty)`,
      [
        order.rows[0].id,
        lines.map(l => l.id),
        lines.map(l => l.name),
        lines.map(l => l.price),
        lines.map(l => l.quantity)
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ code: order.rows[0].code, total });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error(err);
    res.status(500).json({ error: 'Không tạo được đơn hàng. Vui lòng thử lại.' });
  } finally {
    client.release();
  }
});

// Xem một đơn bằng mã đơn
app.get('/api/orders/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!/^DH-[0-9A-F]{12}$/.test(code)) {
    return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
  }
  try {
    const o = await pool.query(
      `SELECT id, code, customer_name, phone, address, note, total,
              payment_method, status, created_at
       FROM orders WHERE code = $1`,
      [code]
    );
    if (o.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }
    const { id, ...order } = o.rows[0];
    const items = await pool.query(
      'SELECT name, price, quantity FROM order_items WHERE order_id = $1 ORDER BY id',
      [id]
    );
    res.set('Cache-Control', 'no-store');
    res.json({ order, items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Các trang
app.get('/thanh-toan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});
app.get('/don-hang/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'order.html'));
});

/* ===================== TÀI KHOẢN ===================== */

// Cấu hình công khai cho trình duyệt (khóa publishable được phép công khai)
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY
  });
});

// Xác định người dùng từ token; không hợp lệ thì coi như khách
async function userFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function requireUser(req, res, next) {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Chưa đăng nhập' });
  req.user = user;
  next();
}

// Lịch sử đơn hàng của người đang đăng nhập
app.get('/api/my/orders', requireUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.code, o.total, o.status, o.created_at,
              COALESCE(
                (SELECT json_agg(json_build_object('name', i.name, 'quantity', i.quantity) ORDER BY i.id)
                 FROM order_items i WHERE i.order_id = o.id),
                '[]'::json
              ) AS items
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.id DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Các trang
app.get('/dang-nhap', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/tai-khoan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account.html'));
});

app.listen(PORT, () => {
  console.log(`Cửa hàng chạy tại http://localhost:${PORT}`);
});

// Kiểm tra giỏ hàng: lấy giá và tồn kho thật từ database, không tin dữ liệu từ trình duyệt
app.post('/api/cart/validate', async (req, res) => {
  const raw = Array.isArray(req.body.items) ? req.body.items.slice(0, 50) : [];

  // Chuẩn hóa: chỉ nhận mã và số lượng hợp lệ, gộp các dòng trùng mã
  const wantedMap = new Map();
  for (const it of raw) {
    const id = Number(it && it.id);
    const quantity = Number(it && it.quantity);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;
    wantedMap.set(id, Math.min(99, (wantedMap.get(id) || 0) + quantity));
  }
  if (wantedMap.size === 0) return res.json({ items: [], total: 0 });

  const user = await userFromRequest(req);
  const userId = user ? user.id : null;
  const ids = [...wantedMap.keys()];
  try {
    const result = await pool.query(
      `SELECT id, name, slug, price, stock, image_url
       FROM products
       WHERE id = ANY($1::int[]) AND is_active = true`,
      [ids]
    );
    const found = new Map(result.rows.map(r => [r.id, r]));

    let total = 0;
    const items = ids.map(id => {
      const wanted = wantedMap.get(id);
      const p = found.get(id);
      if (!p) return { id, available: false, wanted };

      const quantity = Math.min(wanted, p.stock);
      const available = quantity > 0;
      const line_total = available ? p.price * quantity : 0;
      total += line_total;
      return {
        ...p,
        wanted,
        quantity,
        available,
        adjusted: available && quantity < wanted,
        line_total
      };
    });

    res.json({ items, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Trang giỏ hàng
app.get('/gio-hang', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cart.html'));
});