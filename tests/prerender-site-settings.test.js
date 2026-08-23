// Prerender ghi cài đặt của CMS thẳng vào HTML tĩnh lúc deploy, để khách vào
// lần đầu (chưa có bộ nhớ đệm) cũng không thấy nội dung mẫu chớp qua.
// Phép thử quan trọng nhất: sau khi prerender, app.js chạy với đúng bộ cài đặt
// đó phải KHÔNG đổi gì trong DOM — có đổi tức là còn chớp.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const { applySettingsToHtml } = require('../scripts/prerender-site-settings.js');

const SETTINGS = {
  hotline: '0912.345.678',
  email: 'lienhe@dha.vn',
  address: 'Số 1, Phố Mới, Hà Nội',
  office_name: 'Văn Phòng Miền Bắc',
  tax_code: '0123456789',
  brand_bio: 'Công ty cung cấp mẫu quặng tiêu chuẩn.',
  logo_text_accent: 'HÀ',
  logo_text_main: 'CẨN',
  hero_tagline: 'Tiêu chuẩn mới',
  hero_title: 'KIM LOẠI\nMÀU DHA',
  hero_description: 'Mô tả hero lấy từ CMS.',
  hero_cert_label: 'CHỨNG NHẬN',
  hero_cert_value: 'ICP-MS',
  stat1_number: '20+',
  stat1_label: 'Năm kinh nghiệm',
  stat2_number: '2.000+',
  stat2_label: 'Mẫu đã giao',
  stat3_number: '0,1%',
  stat3_label: 'Sai số tối đa',
  price_intro_home: 'Giá cập nhật mỗi sáng.',
  facebook_url: 'https://facebook.com/dha',
};

// Những chỗ app.js đụng tới khi áp cài đặt — cũng chính là những chỗ có thể chớp.
const DYNAMIC_SELECTORS = [
  '.site-hotline',
  '.site-email',
  '.site-address',
  '.site-office-name',
  '.site-tax-code',
  '.site-brand-bio',
  '[data-site-text]',
  '.logo-accent',
  '.logo-text',
  '.hero-tagline',
  '.hero-title',
  '.hero-description',
  '.spec-badge-label',
  '.spec-badge-value',
  '.stat-number',
  '.stat-label',
  'a[href^="tel:"]',
  'a[aria-label]',
];

function snapshot(window) {
  return DYNAMIC_SELECTORS.map((selector) =>
    [...window.document.querySelectorAll(selector)].map((el) => el.outerHTML).join('\n'),
  );
}

function runAppJs(html, settings) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://dhakimloaimau.vn/',
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = (url) =>
    String(url).includes('/api/site-setting')
      ? Promise.resolve({ ok: true, json: async () => ({ data: settings }) })
      : Promise.reject(new Error('network disabled in tests'));
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);
  return window;
}

function readPage(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

// Mọi trang công khai (preview.html là trang xem trước nội bộ, không có header thật).
const PAGES = fs
  .readdirSync(root)
  .filter((file) => file.endsWith('.html'))
  .filter((file) => readPage(file).includes('class="site-header"'));

for (const file of PAGES) {
  test(`${file}: prerender xong thì app.js không phải sửa gì nữa`, async () => {
    const window = runAppJs(applySettingsToHtml(readPage(file), SETTINGS), SETTINGS);

    const before = snapshot(window);
    await window.initSiteSettings();
    const after = snapshot(window);

    for (const [index, selector] of DYNAMIC_SELECTORS.entries()) {
      assert.equal(after[index], before[index], `${selector} bị app.js sửa lại → còn chớp`);
    }
  });
}

test('hotline nằm sẵn trong HTML, không cần chạy JS mới thấy', () => {
  const html = applySettingsToHtml(readPage('index.html'), SETTINGS);

  assert.ok(html.includes('0912.345.678'), 'số mới có trong HTML');
  assert.ok(!html.includes('086.725.9078'), 'số mẫu cũ đã bị thay hết');
  assert.ok(html.includes('tel:0912345678'), 'link gọi dùng số đã bỏ dấu chấm');
});

test('khoá nào CMS bỏ trống thì giữ nguyên chữ có sẵn, không xóa trắng trang', () => {
  const html = applySettingsToHtml(readPage('contact.html'), { hotline: '0912345678' });

  assert.ok(html.includes('MINERALS'), 'logo chữ giữ nguyên');
  assert.ok(html.includes('daihoaian1256@gmail.com'), 'email mẫu giữ nguyên khi CMS chưa nhập');
});

test('chữ từ CMS được escape, không cho chèn thẻ vào trang', () => {
  const html = applySettingsToHtml(readPage('index.html'), {
    hotline: '0912345678',
    office_name: '<script>alert(1)</script>',
  });

  assert.ok(!html.includes('<script>alert(1)</script>'), 'thẻ script không lọt vào HTML');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'nội dung hiện dạng chữ');
});

test('chạy prerender nhiều lần cho ra cùng một kết quả', () => {
  const once = applySettingsToHtml(readPage('index.html'), SETTINGS);
  const twice = applySettingsToHtml(once, SETTINGS);

  assert.equal(twice, once);
});

// Khi CMS bỏ trống một ô, prerender giữ nguyên chữ mẫu còn app.js lại xóa trắng
// — chữ hiện lên rồi biến mất, vẫn là chớp. Hai bên phải cùng một quy ước:
// bỏ trống thì giữ nguyên chữ có sẵn (giống cách logo và data-site-text vẫn làm).
test('CMS bỏ trống ô nào thì app.js cũng không xóa chữ mẫu của ô đó', async () => {
  const partial = { hotline: '0912345678' };
  const window = runAppJs(applySettingsToHtml(readPage('contact.html'), partial), partial);

  const before = snapshot(window);
  await window.initSiteSettings();
  const after = snapshot(window);

  for (const [index, selector] of DYNAMIC_SELECTORS.entries()) {
    assert.equal(after[index], before[index], `${selector} bị app.js xóa trắng → còn chớp`);
  }
});
