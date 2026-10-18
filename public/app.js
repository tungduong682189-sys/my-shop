const grid = document.getElementById('product-grid');
const chipsEl = document.getElementById('chips');
const subChipsEl = document.getElementById('subchips');
const searchEl = document.getElementById('search');
const sortEl = document.getElementById('sort');
const statusEl = document.getElementById('status');
const emptyEl = document.getElementById('empty');
const moreBtn = document.getElementById('more');

const state = { category: '', q: '', sort: 'newest', page: 1, pages: 1 };
let categories = [];
let requestId = 0;

/* ===== Địa chỉ trang lưu bộ lọc ===== */

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.category = p.get('category') || '';
  state.q = p.get('q') || '';
  const sort = p.get('sort');
  state.sort = ['newest', 'price_asc', 'price_desc'].includes(sort) ? sort : 'newest';
  searchEl.value = state.q;
  sortEl.value = state.sort;
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.category) p.set('category', state.category);
  if (state.q) p.set('q', state.q);
  if (state.sort !== 'newest') p.set('sort', state.sort);
  const qs = p.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

/* ===== Danh mục ===== */

function makeChip(label, slug, active) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip' + (active ? ' active' : '');
  btn.dataset.slug = slug;
  btn.textContent = label;
  return btn;
}

function renderChips() {
  const selected = categories.find(c => c.slug === state.category);
  const topId = selected ? (selected.parent_id || selected.id) : null;

  chipsEl.innerHTML = '';
  chipsEl.appendChild(makeChip('Tất cả', '', state.category === ''));
  categories
    .filter(c => !c.parent_id)
    .forEach(c => chipsEl.appendChild(makeChip(c.name, c.slug, c.id === topId)));

  const children = topId ? categories.filter(c => c.parent_id === topId) : [];
  subChipsEl.innerHTML = '';
  subChipsEl.hidden = children.length === 0;
  children.forEach(c => subChipsEl.appendChild(makeChip(c.name, c.slug, c.slug === state.category)));
}

function onChipClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  state.category = btn.dataset.slug;
  renderChips();
  writeUrl();
  loadProducts();
}
chipsEl.addEventListener('click', onChipClick);
subChipsEl.addEventListener('click', onChipClick);

/* ===== Sản phẩm ===== */

async function loadProducts(append = false) {
  const id = ++requestId;
  if (!append) state.page = 1;

  const params = new URLSearchParams({ page: state.page, limit: 12, sort: state.sort });
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);

  statusEl.textContent = 'Đang tải...';
  moreBtn.disabled = true;

  try {
    const res = await fetch('/api/products?' + params);
    if (!res.ok) throw new Error('Lỗi tải sản phẩm');
    const data = await res.json();
    if (id !== requestId) return; // đã có yêu cầu mới hơn, bỏ kết quả cũ

    if (!append) grid.innerHTML = '';
    data.items.forEach(p => grid.appendChild(productCard(p)));

    state.pages = data.pages;
    statusEl.textContent = `${data.total} sản phẩm`;
    emptyEl.hidden = data.total > 0;
    moreBtn.hidden = state.page >= state.pages;
  } catch (err) {
    console.error(err);
    if (id !== requestId) return;
    if (append) state.page--;
    statusEl.textContent = 'Không tải được sản phẩm. Hãy thử lại.';
  } finally {
    if (id === requestId) moreBtn.disabled = false;
  }
}

moreBtn.addEventListener('click', () => {
  state.page++;
  loadProducts(true);
});

/* ===== Tìm kiếm và sắp xếp ===== */

let searchTimer = null;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = searchEl.value.trim();
    writeUrl();
    loadProducts();
  }, 300);
});

sortEl.addEventListener('change', () => {
  state.sort = sortEl.value;
  writeUrl();
  loadProducts();
});

/* ===== Khởi động ===== */

async function init() {
  readUrl();
  try {
    const res = await fetch('/api/categories');
    if (res.ok) categories = await res.json();
  } catch (err) {
    console.error(err);
  }
  renderChips();
  loadProducts();
}

init();