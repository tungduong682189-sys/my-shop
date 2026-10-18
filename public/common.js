const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const COLORS = ['#F6D5C8', '#D5E8D4', '#D6E4F5', '#F5E6B8', '#E6D5F0', '#CFE8E8'];

function colorFor(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

// Chỉ nhận đường dẫn ảnh bắt đầu bằng http:// hoặc https://
function isSafeUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function productUrl(p) {
  return '/san-pham/' + encodeURIComponent(p.slug);
}

// Ảnh sản phẩm; nếu chưa có ảnh thì hiện ô màu kèm chữ cái đầu
function buildThumb(p) {
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  if (isSafeUrl(p.image_url)) {
    const img = document.createElement('img');
    img.src = p.image_url;
    img.alt = p.name;
    img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    thumb.style.background = colorFor(p.name);
    thumb.textContent = p.name.trim().charAt(0).toUpperCase();
  }
  if (p.stock === 0) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Hết hàng';
    thumb.appendChild(badge);
  }
  return thumb;
}

// Thẻ sản phẩm trong lưới (bấm vào để mở trang chi tiết)
function productCard(p) {
  const card = document.createElement('a');
  card.className = 'card';
  card.href = productUrl(p);

  const info = document.createElement('div');
  info.className = 'info';

  if (p.category) {
    const cat = document.createElement('span');
    cat.className = 'cat';
    cat.textContent = p.category;
    info.appendChild(cat);
  }

  const name = document.createElement('h3');
  name.className = 'name';
  name.textContent = p.name;
  info.appendChild(name);

  if (p.stock > 0 && p.stock <= 5) {
    const low = document.createElement('span');
    low.className = 'stock';
    low.textContent = `Chỉ còn ${p.stock} sản phẩm`;
    info.appendChild(low);
  }

  const price = document.createElement('div');
  price.className = 'price';
  price.textContent = money.format(p.price);
  info.appendChild(price);

  card.append(buildThumb(p), info);
  return card;
}

/* ===== Giỏ hàng (chỉ lưu mã và số lượng, không lưu giá) ===== */

const CART_KEY = 'cart_v1';
let memoryCart = []; // dự phòng nếu trình duyệt chặn lưu trữ

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .map(i => ({ id: Number(i && i.id), quantity: Number(i && i.quantity) }))
      .filter(i => Number.isInteger(i.id) && i.id > 0 && Number.isInteger(i.quantity) && i.quantity > 0);
  } catch {
    return memoryCart.slice();
  }
}

function saveCart(items) {
  memoryCart = items.slice();
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {}
  updateCartBadge();
}

function cartCount() {
  return loadCart().reduce((sum, i) => sum + i.quantity, 0);
}

// Trả về số đã thêm được và việc có bị chặn bởi tồn kho hay không
function addToCart(id, qty, stock) {
  const cart = loadCart();
  const max = Math.min(99, stock);
  const current = cart.find(i => i.id === id);
  const have = current ? current.quantity : 0;
  const next = Math.min(max, have + qty);
  const added = next - have;

  if (current) current.quantity = next;
  else if (next > 0) cart.push({ id, quantity: next });
  saveCart(cart);

  return { added, capped: have + qty > max };
}

function updateCartBadge() {
  const el = document.getElementById('cart-count');
  if (!el) return;
  const n = cartCount();
  el.textContent = n > 99 ? '99+' : String(n);
  el.hidden = n === 0;
}

// Cập nhật khi giỏ thay đổi ở tab khác
window.addEventListener('storage', e => {
  if (e.key === CART_KEY) updateCartBadge();
});

updateCartBadge();