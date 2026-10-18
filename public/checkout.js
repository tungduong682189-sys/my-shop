const loadingEl = document.getElementById('co-loading');
const layoutEl = document.getElementById('co-layout');
const noticeEl = document.getElementById('co-notice');
const listEl = document.getElementById('co-items');
const totalEl = document.getElementById('co-total');
const form = document.getElementById('co-form');
const errorEl = document.getElementById('form-error');
const placeBtn = document.getElementById('place-btn');
const nameEl = document.getElementById('f-name');
const phoneEl = document.getElementById('f-phone');
const addressEl = document.getElementById('f-address');
const noteEl = document.getElementById('f-note');

const FIELD_BY_KEY = {
  customer_name: nameEl,
  phone: phoneEl,
  address: addressEl
};

let items = [];
let total = 0;
let submitting = false;
let redirecting = false;
let requestId = 0;

function normalizePhone(value) {
  let s = String(value || '').replace(/[\s.\-()]/g, '');
  if (s.startsWith('+84')) s = '0' + s.slice(3);
  return /^0\d{9}$/.test(s) ? s : null;
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

function setError(message, fieldEl) {
  errorEl.textContent = message || '';
  [nameEl, phoneEl, addressEl].forEach(el => el.closest('.field').classList.remove('invalid'));
  if (fieldEl) {
    fieldEl.closest('.field').classList.add('invalid');
    fieldEl.focus();
  }
}

function renderSummary() {
  listEl.innerHTML = '';
  items.forEach(it => {
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'o-name';
    name.textContent = `${it.name} × ${it.quantity}`;

    const price = document.createElement('span');
    price.className = 'o-price';
    price.textContent = money.format(it.line_total);

    li.append(name, price);
    listEl.appendChild(li);
  });
  totalEl.textContent = money.format(total);
}

// Lấy lại giỏ hàng từ máy chủ (giá và tồn kho thật)
async function refresh() {
  const id = ++requestId;
  const cart = loadCart();
  if (cart.length === 0) {
    location.replace('/gio-hang');
    return;
  }

  try {
    const res = await fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart })
    });
    if (!res.ok) throw new Error('Lỗi tải giỏ hàng');
    const data = await res.json();
    if (id !== requestId) return;

    const good = data.items.filter(i => i.available);
    const notes = [];
    data.items.forEach(i => {
      if (!i.available) {
        notes.push(
          i.name
            ? `"${i.name}" đã hết hàng nên được bỏ khỏi đơn.`
            : 'Một sản phẩm không còn bán nên được bỏ khỏi đơn.'
        );
      } else if (i.adjusted) {
        notes.push(`"${i.name}" chỉ còn ${i.stock} sản phẩm nên số lượng đã giảm xuống ${i.quantity}.`);
      }
    });

    saveCart(good.map(i => ({ id: i.id, quantity: i.quantity })));
    showNotices(notes);

    if (good.length === 0) {
      location.replace('/gio-hang');
      return;
    }

    items = good;
    total = data.total;
    renderSummary();
    loadingEl.hidden = true;
    layoutEl.hidden = false;
  } catch (err) {
    console.error(err);
    if (id !== requestId) return;
    loadingEl.hidden = false;
    loadingEl.textContent = 'Không tải được giỏ hàng. Hãy thử tải lại trang.';
  }
}

function validateForm() {
  const name = nameEl.value.trim();
  const address = addressEl.value.trim();

  if (name.length < 2) {
    setError('Vui lòng nhập họ và tên.', nameEl);
    return false;
  }
  if (!normalizePhone(phoneEl.value)) {
    setError('Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 0).', phoneEl);
    return false;
  }
  if (address.length < 10) {
    setError('Vui lòng nhập địa chỉ đầy đủ (số nhà, đường, phường/xã, quận/huyện, tỉnh/thành).', addressEl);
    return false;
  }
  return true;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;
  setError('');
  if (!validateForm()) return;

  submitting = true;
  placeBtn.disabled = true;
  placeBtn.textContent = 'Đang gửi đơn...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(i => ({ id: i.id, quantity: i.quantity })),
        customer_name: nameEl.value.trim(),
        phone: phoneEl.value.trim(),
        address: addressEl.value.trim(),
        note: noteEl.value.trim(),
        payment_method: 'cod',
        expected_total: total
      })
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 201 && data.code) {
      redirecting = true;
      saveCart([]);
      location.href = '/don-hang/' + encodeURIComponent(data.code);
      return;
    }

    if (res.status === 409) {
      setError(data.message || 'Giỏ hàng đã thay đổi. Vui lòng kiểm tra lại.');
      await refresh();
    } else {
      setError(data.error || 'Không đặt được hàng. Vui lòng thử lại.', FIELD_BY_KEY[data.field]);
    }
  } catch (err) {
    console.error(err);
    setError('Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.');
  } finally {
    if (!redirecting) {
      submitting = false;
      placeBtn.disabled = false;
      placeBtn.textContent = 'Đặt hàng';
    }
  }
});

refresh();