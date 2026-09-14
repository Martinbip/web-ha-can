// Chống tái phát nội dung viết cứng trong HTML (lộ trình 2026-09-14): chữ khách
// nhìn thấy phải nằm trong vùng lấy từ CMS. Mỗi đợt của lộ trình mở rộng file này.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const { getResourceConfig } = require('../dha-cms/src/api/admin-ui/services/resource-config');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function load(file) {
  return new JSDOM(read(file)).window.document;
}

// Trang công khai = trang có header thật (preview.html là trang xem trước của admin).
const PAGES = fs
  .readdirSync(root)
  .filter((file) => file.endsWith('.html'))
  .filter((file) => read(file).includes('class="site-header"'));

test('quét đủ 9 trang công khai', () => {
  assert.equal(PAGES.length, 9, `mới thấy: ${PAGES.join(', ')}`);
});

test('khung hotline không còn chữ viết cứng', () => {
  const box = load('index.html').querySelector('.widget-hotline');
  assert.ok(box, 'trang chủ có khung hotline');
  assert.equal(box.querySelector('.widget-title').dataset.siteText, 'hotline_box_title');
  assert.equal(box.querySelector('.widget-hotline-desc').dataset.siteText, 'hotline_box_note');

  box.querySelectorAll('[data-site-text], .site-hotline').forEach((el) => el.remove());
  assert.equal(box.textContent.trim(), '', 'mọi chữ trong khung đều nối CMS');
});

test('mô tả khung hotline xuống dòng bằng CSS, không bằng <br>', () => {
  assert.match(read('styles.css'), /\.widget-hotline-desc \{[^}]*white-space: pre-line;/);
  assert.equal(load('index.html').querySelector('.widget-hotline-desc br'), null);
});

test('Cài đặt website có hai trường của khung hotline và admin sửa được', () => {
  const schema = JSON.parse(read('dha-cms/src/api/site-setting/content-types/site-setting/schema.json'));
  assert.equal(schema.attributes.hotline_box_title.type, 'string');
  assert.equal(schema.attributes.hotline_box_title.maxLength, 60);
  assert.equal(schema.attributes.hotline_box_note.type, 'text');
  assert.equal(schema.attributes.hotline_box_note.maxLength, 300);

  const config = getResourceConfig('site-setting');
  assert.ok(config.editableFields.includes('hotline_box_title'));
  assert.ok(config.editableFields.includes('hotline_box_note'));

  const adminConfig = read('admin/src/config/resources.js');
  assert.match(adminConfig, /hotline_box_title: \{ label: 'Tiêu đề khung hotline'/);
  assert.match(adminConfig, /hotline_box_note: \{ label: 'Mô tả khung hotline', type: 'textarea'/);

  // Bản ghi cũ (trước khi thêm 2 trường này) có hotline_box_note = null trong
  // khi website vẫn hiện chữ mặc định — hint phải nói rõ bỏ trống thì web vẫn
  // hiện chữ mặc định, để quản trị viên không tưởng khung đang trống.
  const noteFieldMatch = adminConfig.match(/hotline_box_note: \{[^}]*\}/);
  assert.ok(noteFieldMatch, 'không tìm thấy khai báo trường hotline_box_note trong admin');
  assert.match(noteFieldMatch[0], /bỏ trống/i, 'hint của hotline_box_note phải nói rõ trường hợp bỏ trống');
  assert.match(
    noteFieldMatch[0],
    /Kỹ sư phản hồi trong 30 phút.*Hỗ trợ 7:30.*17:30/s,
    'hint của hotline_box_note phải nêu đúng chữ mặc định trên website',
  );

  const titleFieldMatch = adminConfig.match(/hotline_box_title: \{[^}]*\}/);
  assert.ok(titleFieldMatch, 'không tìm thấy khai báo trường hotline_box_title trong admin');
  assert.match(titleFieldMatch[0], /HOTLINE TƯ VẤN/, 'hint hoặc placeholder của hotline_box_title phải nêu chữ mặc định');

  // dha-cms: default của hotline_box_note phải khớp đúng schema, nhất quán
  // với hotline_box_title (đã có default từ trước).
  const cmsConfigSource = read('dha-cms/src/api/admin-ui/services/resource-config.js');
  const schemaDefault = schema.attributes.hotline_box_note.default;
  const cmsNoteMatch = cmsConfigSource.match(/hotline_box_note: \{[^}]*\}/);
  assert.ok(cmsNoteMatch, 'không tìm thấy khai báo trường hotline_box_note trong resource-config CMS');
  const literalDefault = schemaDefault.replace(/\n/g, '\\n');
  assert.ok(
    cmsNoteMatch[0].includes(`default: '${literalDefault}'`),
    'default của hotline_box_note trong resource-config CMS phải khớp default trong schema',
  );
});

const DEFAULT_SLUGS = new Set(JSON.parse(read('data/product_categories.json')).map((category) => category.slug));

test('mọi link lọc danh mục nằm trong vùng lấy từ CMS và dùng mã có thật', () => {
  for (const file of PAGES) {
    for (const link of load(file).querySelectorAll('a[href*="/products?filter="]')) {
      const label = link.textContent.trim();
      assert.ok(link.closest('[data-category-list]'), `${file}: link "${label}" viết cứng ngoài [data-category-list]`);
      const slug = new URL(link.getAttribute('href'), 'https://dhakimloaimau.vn').searchParams.get('filter');
      assert.ok(DEFAULT_SLUGS.has(slug), `${file}: link "${label}" dùng mã lọc "${slug}" không có trong danh mục`);
    }
  }
});

test('trang nào cũng có danh sách danh mục ở chân trang, trang chủ có thêm khối bên hông', () => {
  for (const file of PAGES) {
    assert.ok(load(file).querySelector('footer [data-category-list]'), `${file} thiếu danh sách danh mục ở chân trang`);
  }
  assert.ok(load('index.html').querySelector('aside [data-category-list]'), 'trang chủ có khối danh mục bên hông');
});

const APP_JS = read('app.js');

// Mở trang chi tiết sản phẩm với một sản phẩm giả, trả về href của nút quay lại.
async function backLinkFor(product) {
  const dom = new JSDOM(read('product-detail.html'), {
    runScripts: 'dangerously',
    url: `https://dhakimloaimau.vn/product-detail?id=${product.uid}`,
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = (url) =>
    String(url).includes('/api/products')
      ? Promise.resolve({ ok: true, json: async () => ({ data: [product] }) })
      : Promise.reject(new Error('network disabled in tests'));
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);

  await window.initProductDetailPage();
  const link = [...window.document.querySelectorAll('#product-detail-content a')]
    .find((a) => a.textContent.includes('Quay Lại Danh Mục'));
  return link.getAttribute('href');
}

test('nút "Quay Lại Danh Mục" trỏ tới danh mục đầu tiên của sản phẩm', async () => {
  const base = { uid: 'quang-dong', name: 'Quặng Đồng', group: 'dong', price: 1000 };
  assert.equal(await backLinkFor({ ...base, categories: ['black-metal', 'color-metal'] }), '/products?filter=black-metal');
  assert.equal(await backLinkFor({ ...base, categories: [] }), '/products', 'chưa có danh mục thì về trang Sản phẩm');
});

test('mọi HTML dùng cùng một bản app.js và styles.css như index.html', () => {
  const indexHtml = read('index.html');
  const appVersion = indexHtml.match(/app\.js\?v=([^"]+)"/);
  const stylesVersion = indexHtml.match(/styles\.css\?v=([^"]+)"/);
  assert.ok(appVersion, 'index.html thiếu ?v= của app.js');
  assert.ok(stylesVersion, 'index.html thiếu ?v= của styles.css');

  const appTag = new RegExp(`app\\.js\\?v=${appVersion[1].replace(/\./g, '\\.')}"`);
  const stylesTag = new RegExp(`styles\\.css\\?v=${stylesVersion[1].replace(/\./g, '\\.')}"`);

  for (const file of fs.readdirSync(root).filter((name) => name.endsWith('.html'))) {
    const html = read(file);
    assert.match(html, appTag, `${file} không dùng app.js?v=${appVersion[1]} như index.html`);
    assert.match(html, stylesTag, `${file} không dùng styles.css?v=${stylesVersion[1]} như index.html`);
  }
});

// Dựng trang products.html chạy thật app.js với fetch giả lập CMS.
async function openProductsPage(url, { products, categories }) {
  const dom = new JSDOM(read('products.html'), {
    runScripts: 'dangerously',
    url,
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = (input) => {
    const url = String(input);
    if (url.includes('/api/product-categories')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: categories }) });
    }
    if (url.includes('/api/products')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: products }) });
    }
    return Promise.reject(new Error('network disabled in tests'));
  };
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);

  await window.initProductsPage();
  return window;
}

test('mã lọc lạ trên URL (?filter=dong) quay về "Tất Cả" thay vì hiện lưới trống', async () => {
  const products = JSON.parse(read('data/products.json'));
  const categories = JSON.parse(read('data/product_categories.json'));

  const window = await openProductsPage('https://dhakimloaimau.vn/products?filter=dong', { products, categories });

  const uids = new Set(
    [...window.document.querySelectorAll('#products-container a[href*="product-detail"]')]
      .map((a) => new URL(a.getAttribute('href'), 'https://dhakimloaimau.vn').searchParams.get('id'))
  );
  assert.equal(uids.size, products.length, 'lưới sản phẩm phải hiện đủ sản phẩm khi mã lọc không khớp tab nào');
  assert.equal(window.document.getElementById('products-empty').style.display, 'none', 'không được hiện thông báo trống');

  const activeBtn = window.document.querySelector('.product-filter-btn.active');
  assert.equal(activeBtn?.dataset.filter, 'all', 'phải tô sáng đúng nút "Tất Cả"');
});

test('mã lọc hợp lệ (?filter=black-metal) vẫn lọc đúng và tô sáng đúng tab', async () => {
  const products = JSON.parse(read('data/products.json'));
  const categories = JSON.parse(read('data/product_categories.json'));

  const window = await openProductsPage('https://dhakimloaimau.vn/products?filter=black-metal', { products, categories });

  const expectedUids = new Set(products.filter((p) => (p.categories || []).includes('black-metal')).map((p) => p.uid));
  const uids = new Set(
    [...window.document.querySelectorAll('#products-container a[href*="product-detail"]')]
      .map((a) => new URL(a.getAttribute('href'), 'https://dhakimloaimau.vn').searchParams.get('id'))
  );
  assert.deepEqual(uids, expectedUids, 'lưới sản phẩm phải đúng danh mục black-metal');

  const activeBtn = window.document.querySelector('.product-filter-btn.active');
  assert.equal(activeBtn?.dataset.filter, 'black-metal', 'phải tô sáng đúng tab black-metal');
});
