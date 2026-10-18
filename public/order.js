const loadingEl = document.getElementById('order-loading');
const viewEl = document.getElementById('order-view');
const missingEl = document.getElementById('order-missing');

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

function infoRow(grid, label, value) {
  if (!value) return;
  grid.append(el('dt', '', label), el('dd', '', value));
}

function showMissing() {
  loadingEl.hidden = true;
  viewEl.hidden = true;
  missingEl.hidden = false;
}

function render(order, items) {
  viewEl.innerHTML = '';

  const head = el('div', 'success');
  if (order.status === 'new') head.appendChild(el('div', 'tick', '✓'));
  head.appendChild(el('h1', '', order.status === 'new' ? 'Đặt hàng thành công!' : 'Thông tin đơn hàng'));
  head.appendChild(el('p', '', 'Mã đơn hàng của bạn (hãy lưu lại):'));
  head.appendChild(el('div', 'order-code', order.code));
  if (order.status === 'new') {
    head.appendChild(el('p', 'sum-note', 'Chúng tôi sẽ liên hệ qua số điện thoại để xác nhận đơn.'));
  }

  const itemsPanel = el('div', 'panel');
  itemsPanel.appendChild(el('h2', '', 'Sản phẩm'));
  const list = el('ul', 'order-list');
  items.forEach(it => {
    const li = document.createElement('li');
    li.append(
      el('span', 'o-name', `${it.name} × ${it.quantity}`),
      el('span', 'o-price', money.format(it.price * it.quantity))
    );
    list.appendChild(li);
  });
  itemsPanel.appendChild(list);

  const totalRow = el('div', 'sum-row total');
  totalRow.append(el('span', '', 'Tổng cộng'), el('strong', '', money.format(order.total)));
  itemsPanel.appendChild(totalRow);

  const infoPanel = el('div', 'panel');
  infoPanel.appendChild(el('h2', '', 'Thông tin đơn hàng'));
  const grid = el('dl', 'info-grid');
  const statusDd = el('span', 'status-pill', STATUS[order.status] || order.status);
  grid.append(el('dt', '', 'Trạng thái'));
  const dd = el('dd');
  dd.appendChild(statusDd);
  grid.appendChild(dd);
  infoRow(grid, 'Ngày đặt', new Date(order.created_at).toLocaleString('vi-VN'));
  infoRow(grid, 'Người nhận', order.customer_name);
  infoRow(grid, 'Điện thoại', order.phone);
  infoRow(grid, 'Địa chỉ', order.address);
  infoRow(grid, 'Ghi chú', order.note);
  infoRow(grid, 'Thanh toán', order.payment_method === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : order.payment_method);
  infoPanel.appendChild(grid);

  const stack = el('div', 'order-stack');
  stack.append(itemsPanel, infoPanel);

  const back = el('a', 'btn', 'Tiếp tục mua sắm');
  back.href = '/';
  const backRow = el('div', 'more-row');
  backRow.appendChild(back);

  viewEl.append(head, stack, backRow);
  loadingEl.hidden = true;
  viewEl.hidden = false;
  document.title = 'Đơn ' + order.code + ' | Cửa hàng nhà đẹp';
}

async function init() {
  const parts = location.pathname.split('/').filter(Boolean);
  let code = '';
  try {
    code = decodeURIComponent(parts[1] || '');
  } catch {
    return showMissing();
  }
  if (!code) return showMissing();

  try {
    const res = await fetch('/api/orders/' + encodeURIComponent(code));
    if (res.status === 404) return showMissing();
    if (!res.ok) throw new Error('Lỗi tải đơn hàng');
    const { order, items } = await res.json();
    render(order, items);
  } catch (err) {
    console.error(err);
    loadingEl.textContent = 'Không tải được đơn hàng. Hãy thử tải lại trang.';
  }
}

init();