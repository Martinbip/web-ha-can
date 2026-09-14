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
