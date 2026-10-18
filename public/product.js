const crumbsEl = document.getElementById('crumbs');
const loadingEl = document.getElementById('loading');
const detailEl = document.getElementById('detail');
const notFoundEl = document.getElementById('notfound');
const relatedWrap = document.getElementById('related-wrap');
const relatedEl = document.getElementById('related');

function crumbLink(text, href) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  return a;
}

function crumbText(text) {
  const s = document.createElement('span');
  s.textContent = text;
  return s;
}

function renderCrumbs(p) {
  crumbsEl.innerHTML = '';
  const parts = [crumbLink('Trang chủ', '/')];
  if (p.parent_slug) {
    parts.push(crumbLink(p.parent_name, '/?category=' + encodeURIComponent(p.parent_slug)));
  }
  if (p.category_slug) {
    parts.push(crumbLink(p.category, '/?category=' + encodeURIComponent(p.category_slug)));
  }
  parts.push(crumbText(p.name));

  parts.forEach((node, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '›';
      crumbsEl.appendChild(sep);
    }
    crumbsEl.appendChild(node);
  });
}

function stockInfo(stock) {
  if (stock === 0) return { text: 'Hết hàng', cls: 'out' };
  if (stock <= 5) return { text: `Chỉ còn ${stock} sản phẩm`, cls: 'low' };
  return { text: 'Còn hàng', cls: 'ok' };
}

function renderBuyBox(p) {
  const box = document.getElementById('buy-box');
  if (!box) return;
  box.innerHTML = '';

  if (p.stock <= 0) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'buy-btn';
    btn.disabled = true;
    btn.textContent = 'Hết hàng';
    box.appendChild(btn);
    return;
  }

  const max = Math.min(99, p.stock);
  let qty = 1;

  const row = document.createElement('div');
  row.className = 'buy-row';

  const stepper = document.createElement('div');
  stepper.className = 'stepper';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Giảm số lượng');

  const qtyEl = document.createElement('span');
  qtyEl.className = 'qty';

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Tăng số lượng');

  stepper.append(minus, qtyEl, plus);

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'buy-btn';
  add.textContent = 'Thêm vào giỏ';

  const msg = document.createElement('p');
  msg.className = 'buy-msg';
  msg.setAttribute('role', 'status');

  function update() {
    qtyEl.textContent = String(qty);
    minus.disabled = qty <= 1;
    plus.disabled = qty >= max;
  }

  minus.addEventListener('click', () => { qty = Math.max(1, qty - 1); update(); });
  plus.addEventListener('click', () => { qty = Math.min(max, qty + 1); update(); });

  add.addEventListener('click', () => {
    const r = addToCart(p.id, qty, p.stock);
    msg.textContent = '';
    if (r.added > 0) {
      msg.append(
        r.capped
          ? `Đã thêm ${r.added} sản phẩm (giỏ đã đạt tối đa số lượng còn trong kho). `
          : `Đã thêm ${r.added} sản phẩm vào giỏ. `
      );
    } else {
      msg.append('Giỏ hàng đã có tối đa số lượng còn trong kho. ');
    }
    const link = document.createElement('a');
    link.href = '/gio-hang';
    link.textContent = 'Xem giỏ hàng';
    msg.appendChild(link);
  });

  row.append(stepper, add);
  box.append(row, msg);
  update();
}

function renderDetail(p) {
  detailEl.innerHTML = '';

  const media = document.createElement('div');
  media.className = 'detail-media';
  media.appendChild(buildThumb(p));

  const info = document.createElement('div');
  info.className = 'detail-info';

  if (p.category) {
    const cat = document.createElement('a');
    cat.className = 'detail-cat';
    cat.href = '/?category=' + encodeURIComponent(p.category_slug);
    cat.textContent = p.category;
    info.appendChild(cat);
  }

  const h1 = document.createElement('h1');
  h1.textContent = p.name;
  info.appendChild(h1);

  const price = document.createElement('div');
  price.className = 'detail-price';
  price.textContent = money.format(p.price);
  info.appendChild(price);

  const st = stockInfo(p.stock);
  const stock = document.createElement('div');
  stock.className = 'stock-line ' + st.cls;
  stock.textContent = st.text;
  info.appendChild(stock);

  // Chỗ chừa sẵn cho nút "Thêm vào giỏ" (làm ở Chặng 4)
  const buy = document.createElement('div');
  buy.id = 'buy-box';
  info.appendChild(buy);

  if (p.description && p.description.trim()) {
    const h = document.createElement('h2');
    h.className = 'desc-title';
    h.textContent = 'Mô tả sản phẩm';
    const desc = document.createElement('p');
    desc.className = 'desc';
    desc.textContent = p.description;
    info.append(h, desc);
  }

  detailEl.append(media, info);
  renderBuyBox(p);
}

function renderRelated(items) {
  relatedEl.innerHTML = '';
  relatedWrap.hidden = items.length === 0;
  items.forEach(p => relatedEl.appendChild(productCard(p)));
}

function showNotFound() {
  loadingEl.hidden = true;
  detailEl.hidden = true;
  relatedWrap.hidden = true;
  notFoundEl.hidden = false;
  document.title = 'Không tìm thấy sản phẩm | Cửa hàng nhà đẹp';
}

async function init() {
  const parts = location.pathname.split('/').filter(Boolean);
  let slug = '';
  try {
    slug = decodeURIComponent(parts[1] || '');
  } catch {
    return showNotFound();
  }
  if (!slug) return showNotFound();

  try {
    const res = await fetch('/api/products/' + encodeURIComponent(slug));
    if (res.status === 404) return showNotFound();
    if (!res.ok) throw new Error('Lỗi tải sản phẩm');
    const { product, related } = await res.json();

    document.title = product.name + ' | Cửa hàng nhà đẹp';
    renderCrumbs(product);
    renderDetail(product);
    renderRelated(related);

    loadingEl.hidden = true;
    detailEl.hidden = false;
  } catch (err) {
    console.error(err);
    loadingEl.textContent = 'Không tải được sản phẩm. Hãy thử tải lại trang.';
  }
}

init();