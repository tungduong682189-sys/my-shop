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