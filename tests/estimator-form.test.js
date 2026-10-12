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

test('HTML mặc định của Dự toán mang đủ giá, đúng mẫu thẻ của hàm render', () => {
  const doc = formDoc(readPage('estimator.html'));
  const priced = (selector) => [...doc.querySelectorAll(selector)].every((o) => Number(o.dataset.price) > 0);
  assert.ok(priced('#est-ore option'), 'quặng mặc định phải có giá');
  assert.ok(priced('#est-pack option'), 'đóng gói mặc định phải có giá');
  assert.ok(priced('#est-method option:not([value="raw"])'), 'phân tích mặc định phải có giá');
  assert.equal(doc.querySelector('#est-method option').value, 'raw', 'lựa chọn không phân tích đứng đầu');
  assert.ok(Number(doc.getElementById('est-permit').dataset.price) > 0);
  const form = doc.getElementById('calculator-form');
  assert.equal(form.dataset.bulkThreshold, '500');
  assert.equal(form.dataset.bulkPercent, '5');

  const firstGroup = doc.querySelector('#est-group option').value;
  for (const option of doc.querySelectorAll('#est-ore option')) {
    assert.equal(option.hidden, option.dataset.group !== firstGroup, `${option.value}: chỉ quặng nhóm đầu được hiện`);
  }
  const groups = new Set([...doc.querySelectorAll('#est-group option')].map((o) => o.value));
  for (const option of doc.querySelectorAll('#est-ore option')) {
    assert.ok(groups.has(option.dataset.group), `${option.value} trỏ tới nhóm không có trong ô Nhóm`);
  }
});

// ── app.js trên DOM thật ──

// Chặn mạng: nguồn nào truyền null thì coi như CMS lỗi.
function runApp(html, { categories = null, products = null, analyses = null, formConfig = null, settings = null } = {}) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://dhakimloaimau.vn/estimator',
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  const ok = (data) => Promise.resolve({ ok: true, status: 200, json: async () => ({ data }) });
  window.fetch = (input) => {
    const target = String(input);
    if (settings && target.includes('/api/site-setting')) return ok(settings);
    if (categories && target.includes('/api/product-categories')) return ok(categories);
    if (products && target.includes('/api/products')) return ok(products);
    if (analyses && target.includes('/api/pricing-analyses')) return ok(analyses);
    if (formConfig && target.includes('/api/form-config')) return ok(formConfig);
    return Promise.reject(new Error('network disabled in tests'));
  };
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);
  return window;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

async function estimate(window, { group, ore, weight, method, pack, permit } = {}) {
  const doc = window.document;
  if (group !== undefined) {
    doc.getElementById('est-group').value = group;
    doc.getElementById('est-group').dispatchEvent(new window.Event('change'));
  }
  if (ore !== undefined) doc.getElementById('est-ore').value = ore;
  if (weight !== undefined) doc.getElementById('est-weight').value = String(weight);
  if (method !== undefined) doc.getElementById('est-method').value = method;
  if (pack !== undefined) doc.getElementById('est-pack').value = pack;
  if (permit !== undefined) doc.getElementById('est-permit').checked = permit;
  doc.getElementById('calculator-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
  const text = (id) => doc.getElementById(id).textContent;
  return {
    total: text('result-total'),
    avg: text('result-avg-price'),
    analysis: text('result-analysis-cost'),
    pack: text('result-pack-cost'),
    discount: doc.getElementById('result-discount').closest('.detail-item').classList.contains('hidden') ? null : text('result-discount'),
  };
}

test('CMS lỗi: Dự toán tính bằng giá mặc định trong HTML, đúng như trước', async () => {
  const window = runApp(readPage('estimator.html'));
  await window.initEstimator();
  // 10 kg Quặng Đồng 85.000đ + hộp 150.000đ + CO 500.000đ.
  const result = await estimate(window, { weight: 10 });
  assert.equal(result.total, '1.500.000đ');
  assert.equal(result.avg, '85.000đ/kg');
  assert.equal(result.pack, '650.000đ');
  assert.equal(result.discount, null);
});

test('từ ngưỡng 500 kg thì chiết khấu 5% tiền quặng', async () => {
  const window = runApp(readPage('estimator.html'));
  await window.initEstimator();
  const result = await estimate(window, { weight: 600, permit: false, method: '1' });
  // 51.000.000 + 1.500.000 + 150.000 − 2.550.000
  assert.equal(result.discount, '-2.550.000đ');
  assert.equal(result.total, '50.100.000đ');
});

test('đổi nhóm thì chỉ hiện quặng của nhóm đó và tính theo quặng đầu của nhóm', async () => {
  const window = runApp(readPage('estimator.html'));
  await window.initEstimator();
  const result = await estimate(window, { group: 'black-metal', weight: 1, permit: false });
  const visible = [...window.document.querySelectorAll('#est-ore option')].filter((o) => !o.hidden).map((o) => o.value);
  assert.deepEqual(visible, ['iron-ore', 'manganese-ore']);
  assert.equal(result.avg, '25.000đ/kg');
  assert.equal(result.total, '175.000đ');
});

test('cấu hình trong admin đổi cách tính: đóng gói, CO, chiết khấu', async () => {
  const cms = cmsData();
  const window = runApp(readPage('estimator.html'), cms);
  await window.initEstimator();
  await settle();
  const result = await estimate(window, { weight: 100, pack: 'thung' });
  // Nhôm 40.000đ × 100 = 4.000.000; thùng 900.000 + CO 700.000; giảm 10% tiền quặng.
  assert.equal(result.avg, '40.000đ/kg');
  assert.equal(result.pack, '1.600.000đ');
  assert.equal(result.discount, '-400.000đ');
  assert.equal(result.total, '5.200.000đ');

  const second = await estimate(window, { group: 'quang-<&>', weight: 1, permit: false, method: '9' });
  assert.equal(second.avg, '40.000đ/kg', 'quặng đầu của nhóm thứ hai là Nhôm');
  assert.equal(second.analysis, '3.500.000đ');
});

const FORM_SELECTORS = ['#calculator-form', '#contact-service'];

function formSnapshot(window) {
  return FORM_SELECTORS.map((selector) => window.document.querySelector(selector)?.outerHTML ?? '');
}

for (const file of ['estimator.html', 'contact.html']) {
  test(`${file}: prerender xong thì app.js không phải sửa gì ở hai form`, async () => {
    const cms = cmsData();
    const window = runApp(applyFormsToHtml(readPage(file), cms), cms);
    const before = formSnapshot(window);
    await window.initEstimator();
    await window.initContactServices();
    await settle();
    assert.deepEqual(formSnapshot(window), before);
  });

  test(`${file}: CMS lỗi thì app.js giữ nguyên HTML của hai form`, async () => {
    const window = runApp(readPage(file));
    const before = formSnapshot(window);
    await window.initEstimator();
    await window.initContactServices();
    await settle();
    assert.deepEqual(formSnapshot(window), before);
  });

  test(`${file}: app.js dựng ra cùng DOM với prerender khi CMS trả lời`, async () => {
    const cms = cmsData();
    const window = runApp(readPage(file), cms);
    await window.initEstimator();
    await window.initContactServices();
    await settle();
    const expected = runApp(applyFormsToHtml(readPage(file), cms));
    assert.deepEqual(formSnapshot(window), formSnapshot(expected));
  });
}

test('sản phẩm có nhưng danh mục lỗi thì app.js giữ nhóm và quặng mặc định', async () => {
  const window = runApp(readPage('estimator.html'), { products: PRODUCTS, settings: SETTINGS });
  const before = window.document.getElementById('est-ore').outerHTML;
  await window.initEstimator();
  await settle();
  assert.equal(window.document.getElementById('est-ore').outerHTML, before);
});

test('app.js và prerender dùng chung quy tắc lọc quặng', () => {
  const window = runApp('<!doctype html><body></body>');
  const categories = pickVisibleCategories(CATEGORIES);
  assert.deepEqual(
    JSON.parse(JSON.stringify(window.pickEstimatorOres(PRODUCTS, categories, SETTINGS))),
    pickEstimatorOres(PRODUCTS, categories, SETTINGS),
  );
  for (const unit of ['đ/kg', ' VNĐ / KG ', 'đ/tấn', '', null]) {
    assert.equal(window.isPerKgUnit(unit), isPerKgUnit(unit), `đơn vị ${unit}`);
  }
});
