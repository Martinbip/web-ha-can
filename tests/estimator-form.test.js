// Form Dự toán và ô Nhu cầu của form Liên hệ: option và con số do quản trị đặt
// (Danh mục, Sản phẩm, Biểu phí phân tích, mục "Dự toán & Liên hệ"). Prerender
// ghi sẵn vào HTML; app.js dựng lại ra đúng cùng DOM và tính tiền chỉ từ DOM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const {
  isPerKgUnit,
  pickEstimatorOres,
  renderEstimatorGroups,
  renderEstimatorOres,
  renderAnalysisOptions,
  renderPackagingOptions,
  renderContactServices,
  applyFormsToHtml,
  pickVisibleCategories,
} = require('../scripts/prerender-site-settings.js');

function readPage(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const CATEGORIES = [
  { slug: 'kim-loai-mau', name: 'Kim Loại Màu', visible: true },
  { slug: 'an', name: 'Ẩn', visible: false },
  { slug: 'quang-<&>', name: 'Quặng <Mẫu> & "Chuẩn"', visible: true },
  { slug: 'trong', name: 'Không có quặng', visible: true },
];

const PRODUCTS = [
  { uid: 'dong', name: 'Đồng <Cu>', price: 90000, price_unit: 'đ/kg', categories: ['kim-loai-mau'], sort_order: 2 },
  { uid: 'nhom', name: 'Nhôm', price: 40000, price_unit: '', categories: ['kim-loai-mau', 'quang-<&>'], sort_order: 1 },
  { uid: 'tan', name: 'Tính theo tấn', price: 5000000, price_unit: 'đ/tấn', categories: ['kim-loai-mau'] },
  { uid: 'lien-he', name: 'Giá liên hệ', price: 100, price_on_request: true, categories: ['kim-loai-mau'] },
  { uid: 'khong-gia', name: 'Chưa có giá', price: null, categories: ['kim-loai-mau'] },
  { uid: 'an-di', name: 'Chỉ ở danh mục ẩn', price: 1000, categories: ['an'] },
  { uid: 'kg-hoa', name: 'Đơn vị viết hoa', price: 7000, price_unit: ' VNĐ / KG ', categories: ['quang-<&>'], sort_order: 3 },
];

const SETTINGS = { price_unit_default: 'đ/kg' };

const ANALYSES = [
  { id: 7, name: 'XRF & "nhanh"', price: 1500000 },
  { id: 8, name: 'Miễn phí', price: 0 },
  { id: 9, name: 'ICP-MS', price: 3500000 },
];

const FORM_CONFIG = {
  packaging: [
    { code: 'hop', name: 'Hộp <kín>', price: 200000 },
    { code: 'thung', name: 'Thùng', price: 900000 },
  ],
  co_label: 'Cần chứng nhận CO & kiểm định',
  co_price: 700000,
  bulk_threshold_kg: 100,
  bulk_discount_percent: 10,
  no_analysis_label: 'Không cần phân tích',
  contact_services: [
    { code: 'tu-van', label: 'Tư vấn <nhanh>' },
    { code: 'mua-mau', label: 'Mua mẫu' },
  ],
};

function cmsData() {
  return {
    categories: pickVisibleCategories(CATEGORIES),
    products: PRODUCTS,
    analyses: ANALYSES,
    formConfig: FORM_CONFIG,
    settings: SETTINGS,
  };
}

test('chỉ đơn vị tính theo kg mới vào Dự toán', () => {
  assert.equal(isPerKgUnit('đ/kg'), true);
  assert.equal(isPerKgUnit(' VNĐ / KG '), true);
  assert.equal(isPerKgUnit('đ/tấn'), false);
  assert.equal(isPerKgUnit('đ/kgs'), false);
  assert.equal(isPerKgUnit(''), false);
});

test('quặng lấy từ sản phẩm có giá theo kg, nhóm theo danh mục đang hiện', () => {
  const groups = pickEstimatorOres(PRODUCTS, pickVisibleCategories(CATEGORIES), SETTINGS);
  assert.deepEqual(groups, [
    {
      slug: 'kim-loai-mau',
      name: 'Kim Loại Màu',
      ores: [
        { uid: 'nhom', name: 'Nhôm', price: 40000 },
        { uid: 'dong', name: 'Đồng <Cu>', price: 90000 },
      ],
    },
    {
      slug: 'quang-<&>',
      name: 'Quặng <Mẫu> & "Chuẩn"',
      ores: [
        { uid: 'nhom', name: 'Nhôm', price: 40000 },
        { uid: 'kg-hoa', name: 'Đơn vị viết hoa', price: 7000 },
      ],
    },
  ]);
});

test('đơn vị bỏ trống thì theo đơn vị mặc định trong Cài đặt website', () => {
  const products = [{ uid: 'a', name: 'A', price: 10, price_unit: '', categories: ['x'] }];
  const categories = [{ slug: 'x', name: 'X' }];
  assert.equal(pickEstimatorOres(products, categories, { price_unit_default: 'đ/tấn' }).length, 0);
  assert.equal(pickEstimatorOres(products, categories, {}).length, 1, 'không cài đặt gì thì coi là đ/kg');
  assert.deepEqual(pickEstimatorOres(null, categories, {}), []);
});

test('option nhóm, quặng: escape chữ, quặng ngoài nhóm đầu bị ẩn', () => {
  const groups = pickEstimatorOres(PRODUCTS, pickVisibleCategories(CATEGORIES), SETTINGS);
  assert.equal(
    renderEstimatorGroups(groups),
    '<option value="kim-loai-mau">Kim Loại Màu</option>'
      + '<option value="quang-&lt;&amp;&gt;">Quặng &lt;Mẫu&gt; &amp; "Chuẩn"</option>',
  );
  assert.equal(
    renderEstimatorOres(groups),
    '<option value="nhom" data-group="kim-loai-mau" data-price="40000">Nhôm</option>'
      + '<option value="dong" data-group="kim-loai-mau" data-price="90000">Đồng &lt;Cu&gt;</option>'
      + '<option value="nhom" data-group="quang-&lt;&amp;&gt;" data-price="40000" hidden>Nhôm</option>'
      + '<option value="kg-hoa" data-group="quang-&lt;&amp;&gt;" data-price="7000" hidden>Đơn vị viết hoa</option>',
  );
});

test('option phân tích: bỏ mục giá 0, ghi giá kiểu Việt Nam', () => {
  assert.equal(
    renderAnalysisOptions(ANALYSES),
    '<option value="7" data-price="1500000">XRF &amp; "nhanh" — 1.500.000đ</option>'
      + '<option value="9" data-price="3500000">ICP-MS — 3.500.000đ</option>',
  );
});

test('option đóng gói và Nhu cầu: escape tên', () => {
  assert.equal(
    renderPackagingOptions(FORM_CONFIG.packaging),
    '<option value="hop" data-price="200000">Hộp &lt;kín&gt;</option>'
      + '<option value="thung" data-price="900000">Thùng</option>',
  );
  assert.equal(
    renderContactServices(FORM_CONFIG.contact_services),
    '<option value="tu-van">Tư vấn &lt;nhanh&gt;</option><option value="mua-mau">Mua mẫu</option>',
  );
});

function formDoc(html) {
  return new JSDOM(html).window.document;
}

test('prerender ghi option, giá CO, nhãn CO và ngưỡng chiết khấu vào Dự toán', () => {
  const doc = formDoc(applyFormsToHtml(readPage('estimator.html'), cmsData()));
  assert.deepEqual([...doc.querySelectorAll('#est-group option')].map((o) => o.value), ['kim-loai-mau', 'quang-<&>']);
  assert.equal(doc.querySelectorAll('#est-ore option').length, 4);
  assert.deepEqual([...doc.querySelectorAll('#est-method option')].map((o) => o.textContent), [
    'Không cần phân tích',
    'XRF & "nhanh" — 1.500.000đ',
    'ICP-MS — 3.500.000đ',
  ]);
  assert.deepEqual([...doc.querySelectorAll('#est-pack option')].map((o) => o.dataset.price), ['200000', '900000']);
  assert.equal(doc.getElementById('est-permit').dataset.price, '700000');
  assert.equal(doc.querySelector('[data-form-text="co_label"]').textContent, 'Cần chứng nhận CO & kiểm định');
  const form = doc.getElementById('calculator-form');
  assert.equal(form.dataset.bulkThreshold, '100');
  assert.equal(form.dataset.bulkPercent, '10');
});

test('prerender ghi danh sách Nhu cầu vào Liên hệ', () => {
  const doc = formDoc(applyFormsToHtml(readPage('contact.html'), cmsData()));
  assert.deepEqual([...doc.querySelectorAll('#contact-service option')].map((o) => [o.value, o.textContent]), [
    ['tu-van', 'Tư vấn <nhanh>'],
    ['mua-mau', 'Mua mẫu'],
  ]);
});

test('CMS không có dữ liệu thì prerender giữ nguyên HTML mặc định', () => {
  for (const file of ['estimator.html', 'contact.html']) {
    const html = readPage(file);
    assert.equal(applyFormsToHtml(html, {}), html, `${file}: không có nguồn nào`);
    assert.equal(
      applyFormsToHtml(html, { categories: pickVisibleCategories([]), products: [], analyses: [], formConfig: {}, settings: {} }),
      html,
      `${file}: nguồn trả về rỗng`,
    );
  }
});

test('chỉ đổi chữ "Không phân tích" thì giữ các mục phân tích mặc định', () => {
  const doc = formDoc(applyFormsToHtml(readPage('estimator.html'), { analyses: [], formConfig: { no_analysis_label: 'Chỉ lấy mẫu' } }));
  const options = [...doc.querySelectorAll('#est-method option')];
  assert.equal(options[0].textContent, 'Chỉ lấy mẫu');
  assert.ok(options.length > 1, 'các mục phân tích mặc định vẫn còn');
  assert.ok(options.slice(1).every((o) => Number(o.dataset.price) > 0), 'mục phân tích mặc định phải có giá');
});

test('sản phẩm có nhưng danh mục lỗi thì giữ nguyên nhóm và quặng', () => {
  const html = readPage('estimator.html');
  const doc = formDoc(applyFormsToHtml(html, { categories: null, products: PRODUCTS }));
  assert.equal(doc.getElementById('est-ore').innerHTML, formDoc(html).getElementById('est-ore').innerHTML);
});
