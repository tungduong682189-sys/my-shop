const emailEl = document.getElementById('account-email');
const loadingEl = document.getElementById('orders-loading');
const listEl = document.getElementById('orders-list');
const emptyEl = document.getElementById('orders-empty');
const logoutBtn = document.getElementById('logout-btn');

const STATUS = {
  new: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  done: 'Hoàn tất',
  cancelled: 'Đã hủy'
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function itemsText(items) {
  const shown = items.slice(0, 3).map(i => `${i.name} × ${i.quantity}`).join(', ');
  const rest = items.length - 3;
  return rest > 0 ? `${shown} và ${rest} sản phẩm khác` : shown;
}

function orderRow(o) {
  const li = el('li', 'panel my-order');

  const top = el('div', 'my-order-top');
  const code = el('a', 'my-order-code', o.code);
  code.href = '/don-hang/' + encodeURIComponent(o.code);
  top.append(code, el('span', 'status-pill', STATUS[o.status] || o.status));

  const meta = el('div', 'my-order-meta', new Date(o.created_at).toLocaleString('vi-VN'));
  const items = el('div', 'my-order-items', itemsText(o.items));
  const total = el('div', 'my-order-total', money.format(o.total));

  li.append(top, meta, items, total);
  return li;
}

async function goLogin() {
  location.replace('/dang-nhap?next=/tai-khoan');
}

logoutBtn.addEventListener('click', async () => {
  const sb = await getSb();
  if (sb) await sb.auth.signOut();
  location.href = '/';
});

async function init() {
  const session = await getSession();
  if (!session) return goLogin();

  emailEl.textContent = session.user.email;

  try {
    const res = await fetch('/api/my/orders', {
      headers: { Authorization: 'Bearer ' + session.access_token }
    });
    if (res.status === 401) {
      const sb = await getSb();
      if (sb) await sb.auth.signOut();
      return goLogin();
    }
    if (!res.ok) throw new Error('Lỗi tải đơn hàng');
    const orders = await res.json();

    loadingEl.hidden = true;
    emptyEl.hidden = orders.length > 0;
    orders.forEach(o => listEl.appendChild(orderRow(o)));
  } catch (err) {
    console.error(err);
    loadingEl.textContent = 'Không tải được đơn hàng. Hãy thử tải lại trang.';
  }
}

init();