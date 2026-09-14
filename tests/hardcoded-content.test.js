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

// Đợt 2: trường đầu trang/chân trang trong Cài đặt website.
const CHROME_FIELDS = {
  header_cta_label: ['string', 40, 'Yêu Cầu Mẫu'],
  header_cta_url: ['string', 300, '/contact'],
  footer_categories_title: ['string', 60, 'DANH MỤC SẢN PHẨM'],
  footer_links_title: ['string', 60, 'HỖ TRỢ KHÁCH HÀNG'],
  copyright_text: ['string', 200, 'Kim Loại Màu DHA. Bản quyền được bảo lưu.'],
};

test('Cài đặt website có các trường đầu trang/chân trang và admin sửa được', () => {
  const schema = JSON.parse(read('dha-cms/src/api/site-setting/content-types/site-setting/schema.json'));
  for (const [name, [type, maxLength, fallback]] of Object.entries(CHROME_FIELDS)) {
    const attribute = schema.attributes[name];
    assert.ok(attribute, `schema thiếu ${name}`);
    assert.equal(attribute.type, type, `${name} sai kiểu`);
    assert.equal(attribute.maxLength, maxLength, `${name} sai độ dài tối đa`);
    assert.equal(attribute.default, fallback, `${name} sai mặc định`);
  }
  assert.equal(schema.attributes.footer_links.type, 'json');

  const config = getResourceConfig('site-setting');
  for (const name of [...Object.keys(CHROME_FIELDS), 'footer_links']) {
    assert.ok(config.editableFields.includes(name), `CMS chưa cho ghi ${name}`);
    assert.ok(config.fields[name], `CMS thiếu khai báo ${name}`);
  }

  const adminConfig = read('admin/src/config/resources.js');
  for (const name of Object.keys(CHROME_FIELDS)) {
    assert.match(adminConfig, new RegExp(`${name}: \\{ label: '`), `admin thiếu ô ${name}`);
  }
  assert.match(adminConfig, /footer_links: \{ label: 'Liên kết chân trang', type: 'link-list'/);
  assert.match(read('admin/src/components/FieldRenderer.jsx'), /case 'link-list':/);
});

// Đợt 2: đầu trang, menu và chân trang dùng chung cho 9 trang.
const CHROME_REGIONS = ['.top-header', 'header.site-header', 'nav.main-navigation', 'footer.footer'];

function chromeOf(file) {
  const doc = load(file);
  // Dấu "đang xem" của menu khác nhau theo trang là đúng — bỏ đi trước khi so.
  doc.querySelectorAll('nav.main-navigation .active').forEach((el) => el.classList.remove('active'));
  return CHROME_REGIONS.map((selector) => {
    const region = doc.querySelector(selector);
    assert.ok(region, `${file} thiếu ${selector}`);
    return region.outerHTML.replace(/\s+/g, ' ');
  });
}

test('9 trang dùng chung một đầu trang, menu và chân trang', () => {
  const reference = chromeOf('index.html');
  for (const file of PAGES) {
    chromeOf(file).forEach((html, index) => {
      assert.equal(html, reference[index], `${file}: ${CHROME_REGIONS[index]} lệch so với index.html`);
    });
  }
});

// Vùng đã nối CMS trong đầu trang/chân trang — chữ trong đó do admin quyết định.
const CHROME_CMS = [
  '.site-hotline', '.site-email', '.site-address', '.site-office-name', '.site-tax-code', '.site-brand-bio',
  '.logo-accent', '.logo-text', '[data-site-text]', '[data-category-list]', '[data-footer-links]',
  '[data-copyright]', 'ul.nav-links', 'a[aria-label]',
].join(', ');

// Nhãn giao diện được phép giữ trong code (nhóm 6 của lộ trình).
const CHROME_ALLOWED_TEXT = new Set(['📞', 'Hotline:', 'Email:', 'Tìm']);

test('đầu trang, menu và chân trang không còn chữ viết cứng ngoài nhãn giao diện', () => {
  for (const file of PAGES) {
    const doc = load(file);
    for (const selector of CHROME_REGIONS) {
      const region = doc.querySelector(selector);
      region.querySelectorAll(CHROME_CMS).forEach((el) => el.remove());
      const walker = doc.createTreeWalker(region, 4 /* SHOW_TEXT */);
      let node;
      while ((node = walker.nextNode())) {
        const value = node.textContent.trim();
        if (!value) continue;
        assert.ok(CHROME_ALLOWED_TEXT.has(value), `${file} ${selector}: "${value}" viết cứng`);
      }
    }
  }
});

test('chân trang mặc định: 5 liên kết đúng thứ tự, đủ 4 mạng xã hội, có email và bản quyền', () => {
  const footer = load('index.html').querySelector('footer.footer');
  assert.deepEqual(
    [...footer.querySelectorAll('[data-footer-links] a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [
      ['Dự Tính Giá Đơn Hàng', '/estimator'],
      ['Đơn Giá Phân Tích', '/pricing'],
      ['Tin Tức Thị Trường', '/news'],
      ['Quy Trình Giao Nhận', '/#workflow'],
      ['Liên Hệ Báo Giá', '/contact'],
    ],
  );
  assert.deepEqual(
    [...footer.querySelectorAll('a.social-link')].map((a) => a.getAttribute('aria-label')),
    ['Facebook', 'YouTube', 'Twitter/X', 'Zalo'],
  );
  assert.ok(footer.querySelector('.site-email'), 'cột liên hệ có email');
  assert.equal(footer.querySelector('[data-site-text="footer_categories_title"]').textContent, 'DANH MỤC SẢN PHẨM');
  assert.equal(footer.querySelector('[data-site-text="footer_links_title"]').textContent, 'HỖ TRỢ KHÁCH HÀNG');
  assert.match(footer.querySelector('[data-copyright]').textContent, /^© \d{4} Kim Loại Màu DHA\. Bản quyền được bảo lưu\.$/);

  const cta = load('index.html').querySelector('.btn-contact');
  assert.equal(cta.dataset.siteText, 'header_cta_label');
  assert.equal(cta.textContent, 'Yêu Cầu Mẫu');
  assert.equal(cta.getAttribute('href'), '/contact');
});

test('không còn link /#about trỏ vào khu không tồn tại', () => {
  for (const file of PAGES) {
    assert.ok(!read(file).includes('/#about'), `${file} còn link /#about`);
  }
});
