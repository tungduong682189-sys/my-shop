const loadingEl = document.getElementById('cart-loading');
const emptyEl = document.getElementById('cart-empty');
const layoutEl = document.getElementById('cart-layout');
const itemsEl = document.getElementById('cart-items');
const noticeEl = document.getElementById('cart-notice');
const totalEl = document.getElementById('cart-total');
const linesEl = document.getElementById('cart-lines');

let requestId = 0;

function setQuantity(id, quantity) {
  const cart = loadCart();
  const next = quantity <= 0
    ? cart.filter(i => i.id !== id)
    : cart.map(i => (i.id === id ? { id, quantity } : i));
  saveCart(next);
  refresh();
}

function showNotices(notes) {
  noticeEl.innerHTML = '';
  noticeEl.hidden = notes.length === 0;
  notes.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    noticeEl.appendChild(li);
  });
}

function showEmpty() {
  loadingEl.hidden = true;
  layoutEl.hidden = true;
  emptyEl.hidden = false;
}

function buildRow(it) {
  const li = document.createElement('li');
  li.className = 'cart-item';

  const thumbLink = document.createElement('a');
  thumbLink.href = productUrl(it);
  thumbLink.className = 'cart-thumb';
  thumbLink.appendChild(buildThumb(it));

  const body = document.createElement('div');
  body.className = 'cart-body';

  const name = document.createElement('a');
  name.className = 'cart-name';
  name.href = productUrl(it);
  name.textContent = it.name;

  const unit = document.createElement('div');
  unit.className = 'cart-unit';
  unit.textContent = money.format(it.price);

  const max = Math.min(99, it.stock);

  const stepper = document.createElement('div');
  stepper.className = 'stepper';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Giảm số lượng');
  minus.disabled = it.quantity <= 1;
  minus.addEventListener('click', () => setQuantity(it.id, it.quantity - 1));

  const qty = document.createElement('span');
  qty.className = 'qty';
  qty.textContent = String(it.quantity);

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Tăng số lượng');
  plus.disabled = it.quantity >= max;
  plus.addEventListener('click', () => setQuantity(it.id, it.quantity + 1));

  stepper.append(minus, qty, plus);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'link-btn';
  remove.textContent = 'Xóa';
  remove.addEventListener('click', () => setQuantity(it.id, 0));

  const actions = document.createElement('div');
  actions.className = 'cart-actions';
  actions.append(stepper, remove);

  body.append(name, unit, actions);

  const line = document.createElement('div');
  line.className = 'cart-line';
  line.textContent = money.format(it.line_total);

  li.append(thumbLink, body, line);
  return li;
}

function render(items, total) {
  loadingEl.hidden = true;
  emptyEl.hidden = true;
  layoutEl.hidden = false;

  itemsEl.innerHTML = '';
  items.forEach(it => itemsEl.appendChild(buildRow(it)));

  linesEl.textContent = String(items.reduce((sum, i) => sum + i.quantity, 0));
  totalEl.textContent = money.format(total);
}

async function refresh() {
  const id = ++requestId;
  const cart = loadCart();
  if (cart.length === 0) {
    showNotices([]);
    return showEmpty();
  }

  try {
    const res = await fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart })
    });
    if (!res.ok) throw new Error('Lỗi tải giỏ hàng');
    const data = await res.json();
    if (id !== requestId) return; // đã có yêu cầu mới hơn

    const good = data.items.filter(i => i.available);
    const notes = [];
    data.items.forEach(i => {
      if (!i.available) {
        notes.push(
          i.name
            ? `"${i.name}" đã hết hàng nên được bỏ khỏi giỏ.`
            : 'Một sản phẩm không còn bán nên được bỏ khỏi giỏ.'
        );
      } else if (i.adjusted) {
        notes.push(`"${i.name}" chỉ còn ${i.stock} sản phẩm nên số lượng đã giảm xuống ${i.quantity}.`);
      }
    });

    // Đồng bộ giỏ trong trình duyệt theo kết quả của máy chủ
    saveCart(good.map(i => ({ id: i.id, quantity: i.quantity })));
    showNotices(notes);

    if (good.length === 0) return showEmpty();
    render(good, data.total);
  } catch (err) {
    console.error(err);
    if (id !== requestId) return;
    loadingEl.hidden = false;
    loadingEl.textContent = 'Không tải được giỏ hàng. Hãy thử tải lại trang.';
  }
}

refresh();