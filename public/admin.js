const gateEl = document.getElementById('gate');
const panelEl = document.getElementById('panel');
const tabsEl = document.getElementById('tabs');
const bodyEl = document.getElementById('tab-body');
const dialogEl = document.getElementById('detail');
const detailBody = document.getElementById('detail-body');

const STATUS = {
  new: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  done: 'Hoàn tất',
  cancelled: 'Đã hủy'
};
const NEXT = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['done', 'cancelled'],
  done: [],
  cancelled: []
};

const state = { tab: 'overview', status: '', ordersQ: '', ordersPage: 1, custQ: '', custPage: 1 };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const fmtDate = d => new Date(d).toLocaleString('vi-VN');

function toLogin() {
  location.replace('/dang-nhap?next=/quan-tri');
}

// Gọi API quản trị với token mới nhất
async function api(path, options = {}) {
  const token = await getToken();
  if (!token) { toLogin(); throw new Error('Chưa đăng nhập'); }
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  });
  if (res.status === 401) { toLogin(); throw new Error('Phiên hết hạn'); }
  return res;
}

function statusPill(status) {
  return el('span', 'status-pill s-' + status, STATUS[status] || status);
}

function table(headers, rows) {
  const wrap = el('div', 'table-wrap');
  const t = el('table', 'admin-table');
  const head = el('tr');
  headers.forEach(h => head.appendChild(el('th', '', h)));
  const thead = el('thead');
  thead.appendChild(head);
  const tbody = el('tbody');
  rows.forEach(cells => {
    const tr = el('tr');
    cells.forEach(c => {
      const td = el('td');
      if (c instanceof Node) td.appendChild(c);
      else td.textContent = c === null || c === undefined ? '' : String(c);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  t.append(thead, tbody);
  wrap.appendChild(t);
  return wrap;
}

function pager(page, pages, total, onChange) {
  const row = el('div', 'pager');
  const prev = el('button', 'secondary-btn small', '← Trước');
  const next = el('button', 'secondary-btn small', 'Sau →');
  prev.type = next.type = 'button';
  prev.disabled = page <= 1;
  next.disabled = page >= pages;
  prev.addEventListener('click', () => onChange(page - 1));
  next.addEventListener('click', () => onChange(page + 1));
  row.append(prev, el('span', '', `Trang ${page}/${pages} · ${total} mục`), next);
  return row;
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ===== Tổng quan ===== */

// Danh sách sản phẩm sắp hết hàng, hiện trong hộp thoại
async function openLowStock() {
  detailBody.textContent = 'Đang tải...';
  if (!dialogEl.open) dialogEl.showModal();
  try {
    const res = await api('/api/admin/low-stock');
    if (!res.ok) throw new Error('Lỗi tải sản phẩm');
    const items = await res.json();

    detailBody.innerHTML = '';
    detailBody.appendChild(el('h2', 'plain-title', 'Sản phẩm sắp hết hàng (còn từ 5 cái trở xuống)'));
    if (items.length === 0) {
      detailBody.appendChild(el('p', 'note', 'Không có sản phẩm nào sắp hết hàng.'));
      return;
    }
    detailBody.appendChild(
      table(
        ['Sản phẩm', 'Danh mục', 'Còn lại'],
        items.map(p => [p.name, p.category || '', p.stock === 0 ? 'Hết hàng' : String(p.stock)])
      )
    );
    detailBody.appendChild(
      el('p', 'note', 'Cập nhật số lượng tại Supabase → Table Editor → products (cột stock). Trang quản lý sản phẩm sẽ có ở chặng sau.')
    );
  } catch (err) {
    console.error(err);
    detailBody.textContent = 'Không tải được danh sách sản phẩm.';
  }
}

async function renderOverview() {
  bodyEl.textContent = 'Đang tải...';
  const res = await api('/api/admin/stats');
  if (!res.ok) { bodyEl.textContent = 'Không tải được số liệu.'; return; }
  const s = await res.json();
  const b = s.byStatus;

  const goOrders = (status) => () => {
    state.status = status;
    state.ordersQ = '';
    state.ordersPage = 1;
    setTab('orders');
  };

  const revenue = b.new.sum + b.confirmed.sum + b.shipping.sum + b.done.sum;
  const cards = [
    { label: 'Đơn chờ xác nhận', value: b.new.count, alert: b.new.count > 0, action: goOrders('new') },
    { label: 'Đã xác nhận', value: b.confirmed.count, action: goOrders('confirmed') },
    { label: 'Đang giao', value: b.shipping.count, action: goOrders('shipping') },
    { label: 'Hoàn tất', value: b.done.count, action: goOrders('done') },
    { label: 'Đã hủy', value: b.cancelled.count, action: goOrders('cancelled') },
    { label: 'Doanh thu (không tính đơn hủy)', value: money.format(revenue), action: goOrders('') },
    {
      label: 'Khách hàng',
      value: s.customers,
      action: () => { state.custQ = ''; state.custPage = 1; setTab('customers'); }
    },
    { label: 'Sản phẩm sắp hết (≤ 5)', value: s.lowStock, alert: s.lowStock > 0, action: openLowStock }
  ];

  bodyEl.innerHTML = '';
  const grid = el('div', 'stat-grid');
  cards.forEach(c => {
    const card = el('button', 'stat' + (c.alert ? ' alert' : ''));
    card.type = 'button';
    card.append(
      el('div', 'stat-value', String(c.value)),
      el('div', 'stat-label', c.label),
      el('div', 'stat-hint', 'Xem chi tiết →')
    );
    card.addEventListener('click', c.action);
    grid.appendChild(card);
  });
  bodyEl.appendChild(grid);
}

/* ===== Đơn hàng ===== */

function renderOrders() {
  bodyEl.innerHTML = '';
  const bar = el('div', 'admin-bar');

  const sel = document.createElement('select');
  [['', 'Tất cả trạng thái'], ...Object.entries(STATUS)].forEach(([v, t]) => {
    const o = el('option', '', t);
    o.value = v;
    sel.appendChild(o);
  });
  sel.value = state.status;

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Tìm mã đơn, tên, số điện thoại, email...';
  search.maxLength = 100;
  search.value = state.ordersQ;

  bar.append(sel, search);
  const area = el('div');
  bodyEl.append(bar, area);

  async function load() {
    area.textContent = 'Đang tải...';
    const p = new URLSearchParams({ page: state.ordersPage });
    if (state.status) p.set('status', state.status);
    if (state.ordersQ) p.set('q', state.ordersQ);
    const res = await api('/api/admin/orders?' + p);
    if (!res.ok) { area.textContent = 'Không tải được đơn hàng.'; return; }
    const data = await res.json();

    area.innerHTML = '';
    if (data.items.length === 0) {
      area.appendChild(el('p', 'note', 'Không có đơn hàng nào.'));
      return;
    }
    const rows = data.items.map(o => {
      const btn = el('button', 'secondary-btn small', 'Xem');
      btn.type = 'button';
      btn.addEventListener('click', () => openDetail(o.id));
      return [
        o.code, fmtDate(o.created_at), o.customer_name, o.phone,
        money.format(o.total), statusPill(o.status),
        o.has_account ? 'Có' : 'Khách', btn
      ];
    });
    area.appendChild(table(['Mã đơn', 'Ngày đặt', 'Khách', 'Điện thoại', 'Tổng tiền', 'Trạng thái', 'Tài khoản', ''], rows));
    area.appendChild(pager(data.page, data.pages, data.total, n => { state.ordersPage = n; load(); }));
  }

  sel.addEventListener('change', () => { state.status = sel.value; state.ordersPage = 1; load(); });
  search.addEventListener('input', debounce(() => {
    state.ordersQ = search.value.trim();
    state.ordersPage = 1;
    load();
  }, 300));
  load();
}

function infoRow(dl, label, value) {
  if (value === null || value === undefined || value === '') return;
  dl.append(el('dt', '', label), el('dd', '', value));
}

function renderDetail(o, items) {
  detailBody.innerHTML = '';
  const head = el('div', 'detail-head');
  head.append(el('h2', '', 'Đơn ' + o.code), statusPill(o.status));

  const dl = el('dl', 'info-grid');
  infoRow(dl, 'Ngày đặt', fmtDate(o.created_at));
  infoRow(dl, 'Người nhận', o.customer_name);
  infoRow(dl, 'Điện thoại', o.phone);
  infoRow(dl, 'Email', o.email);
  infoRow(dl, 'Tài khoản', o.has_account ? 'Có tài khoản' : 'Khách đặt không đăng nhập');
  infoRow(dl, 'Địa chỉ', o.address);
  infoRow(dl, 'Ghi chú', o.note);
  infoRow(dl, 'Thanh toán', o.payment_method === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : o.payment_method);

  const list = el('ul', 'order-list');
  items.forEach(it => {
    const li = document.createElement('li');
    li.append(
      el('span', 'o-name', `${it.name} × ${it.quantity}`),
      el('span', 'o-price', money.format(it.price * it.quantity))
    );
    list.appendChild(li);
  });
  const total = el('div', 'sum-row total');
  total.append(el('span', '', 'Tổng cộng'), el('strong', '', money.format(o.total)));

  const actions = el('div', 'detail-actions');
  (NEXT[o.status] || []).forEach(next => {
    const b = el('button', next === 'cancelled' ? 'danger-btn' : 'buy-btn small', next === 'cancelled' ? 'Hủy đơn' : 'Chuyển sang: ' + STATUS[next]);
    b.type = 'button';
    b.addEventListener('click', () => changeStatus(o, next, b));
    actions.appendChild(b);
  });
  if (!actions.children.length) actions.appendChild(el('p', 'note', 'Đơn này đã kết thúc, không đổi trạng thái được nữa.'));

  const msg = el('p', 'form-error');
  msg.id = 'detail-msg';
  detailBody.append(head, dl, el('h3', '', 'Sản phẩm'), list, total, actions, msg);
}

async function openDetail(id) {
  detailBody.textContent = 'Đang tải...';
  if (!dialogEl.open) dialogEl.showModal();
  try {
    const res = await api('/api/admin/orders/' + id);
    if (!res.ok) throw new Error('Lỗi tải đơn');
    const { order, items } = await res.json();
    order.id = id;
    renderDetail(order, items);
  } catch (err) {
    console.error(err);
    detailBody.textContent = 'Không tải được đơn hàng.';
  }
}

async function changeStatus(order, next, btn) {
  if (next === 'cancelled' && !confirm('Hủy đơn này? Số lượng hàng sẽ được cộng lại vào kho.')) return;
  btn.disabled = true;
  try {
    const res = await api(`/api/admin/orders/${order.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = document.getElementById('detail-msg');
      if (msg) msg.textContent = data.error || 'Không đổi được trạng thái.';
      btn.disabled = false;
      return;
    }
    await openDetail(order.id);
    showTab(state.tab);
  } catch (err) {
    console.error(err);
    btn.disabled = false;
  }
}

document.getElementById('detail-close').addEventListener('click', () => dialogEl.close());

/* ===== Khách hàng ===== */

function renderCustomers() {
  bodyEl.innerHTML = '';
  const bar = el('div', 'admin-bar');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Tìm tên, số điện thoại, email...';
  search.maxLength = 100;
  search.value = state.custQ;
  bar.appendChild(search);
  const area = el('div');
  bodyEl.append(bar, area);

  async function load() {
    area.textContent = 'Đang tải...';
    const p = new URLSearchParams({ page: state.custPage });
    if (state.custQ) p.set('q', state.custQ);
    const res = await api('/api/admin/customers?' + p);
    if (!res.ok) { area.textContent = 'Không tải được danh sách khách hàng.'; return; }
    const data = await res.json();

    area.innerHTML = '';
    if (data.items.length === 0) {
      area.appendChild(el('p', 'note', 'Chưa có khách hàng nào.'));
      return;
    }
    const rows = data.items.map(c => {
      const btn = el('button', 'secondary-btn small', 'Xem đơn');
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.ordersQ = c.phone;
        state.status = '';
        state.ordersPage = 1;
        setTab('orders');
      });
      return [
        c.name, c.phone, c.email || '', c.has_account ? 'Có' : 'Khách',
        c.orders, money.format(c.spent), fmtDate(c.last_order), btn
      ];
    });
    area.appendChild(table(['Tên', 'Điện thoại', 'Email', 'Tài khoản', 'Số đơn', 'Đã chi', 'Đơn gần nhất', ''], rows));
    area.appendChild(pager(data.page, data.pages, data.total, n => { state.custPage = n; load(); }));
  }

  search.addEventListener('input', debounce(() => {
    state.custQ = search.value.trim();
    state.custPage = 1;
    load();
  }, 300));
  load();
}

/* ===== Tab ===== */

function showTab(name) {
  if (name === 'orders') renderOrders();
  else if (name === 'customers') renderCustomers();
  else renderOverview();
}

function setTab(name) {
  state.tab = name;
  tabsEl.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  showTab(name);
}

tabsEl.addEventListener('click', e => {
  const btn = e.target.closest('.tab');
  if (btn) setTab(btn.dataset.tab);
});

/* ===== Khởi động ===== */

async function init() {
  const token = await getToken();
  if (!token) return toLogin();

  try {
    const res = await fetch('/api/admin/me', { headers: { Authorization: 'Bearer ' + token } });
    if (res.status === 401) return toLogin();
    if (res.status === 403) {
      gateEl.textContent = 'Tài khoản này không có quyền quản trị.';
      return;
    }
    if (!res.ok) throw new Error('Lỗi kiểm tra quyền');
    gateEl.hidden = true;
    panelEl.hidden = false;
    setTab('overview');
  } catch (err) {
    console.error(err);
    gateEl.textContent = 'Không kiểm tra được quyền truy cập. Hãy thử tải lại trang.';
  }
}

init();