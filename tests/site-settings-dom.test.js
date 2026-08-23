// Kiểm tra hành vi thật của app.js trên DOM thật (jsdom) thay vì chỉ soi mã nguồn:
// logo và các câu chữ do quản trị đặt phải áp đúng vào header/footer của trang.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

const HTML_PAGES = fs
  .readdirSync(root)
  .filter((file) => file.endsWith('.html'));

// Trang được dựng nguyên trạng rồi nhét app.js vào chạy. fetch bị chặn để test
// không chạm mạng: mọi phần render động sẽ bỏ qua, còn hàm cần kiểm thì vẫn có.
function loadPage(file = 'index.html') {
  const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'), {
    runScripts: 'dangerously',
    url: 'https://dhakimloaimau.vn/',
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = () => Promise.reject(new Error('network disabled in tests'));
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);
  return window;
}

function logoLinks(window) {
  return [...window.document.querySelectorAll('a.logo')];
}

test('mọi trang có header website đều có logo dạng chữ để quản trị sửa được', () => {
  // preview.html là trang xem trước nội bộ, không dựng header/footer thật.
  const pages = HTML_PAGES.filter((file) =>
    fs.readFileSync(path.join(root, file), 'utf8').includes('class="site-header"'),
  );
  assert.ok(pages.length >= 8, `phải quét được các trang công khai, mới có ${pages.length}`);

  for (const file of pages) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /class="logo"/, `${file} có thẻ logo`);
    assert.match(html, /class="logo-accent"/, `${file} có phần chữ nhấn`);
    assert.match(html, /class="logo-text/, `${file} có phần chữ còn lại`);
  }
});

test('logo chữ đổi theo cài đặt ở cả header lẫn footer', () => {
  const window = loadPage();
  const links = logoLinks(window);
  assert.ok(links.length >= 2, 'trang chủ có logo ở header và footer');

  window.applyLogo({ logo_text_accent: 'HÀ', logo_text_main: 'CẨN' });

  for (const link of links) {
    assert.equal(link.querySelector('.logo-accent').textContent, 'HÀ');
    assert.equal(link.querySelector('.logo-text').textContent, 'CẨN');
  }
  // Logo footer là chữ trắng — đổi nội dung không được làm mất lớp màu.
  assert.ok(
    links.some((link) => link.querySelector('.logo-text').classList.contains('text-white')),
    'logo footer giữ nguyên lớp text-white',
  );
});

test('bỏ trống chữ logo thì giữ nguyên chữ có sẵn, không xóa trắng', () => {
  const window = loadPage();
  const [link] = logoLinks(window);

  window.applyLogo({ logo_text_accent: '', logo_text_main: '   ' });

  assert.equal(link.querySelector('.logo-accent').textContent, 'DHA');
  assert.equal(link.querySelector('.logo-text').textContent, 'MINERALS');
});

test('có ảnh logo thì ảnh thay chỗ chữ, alt lấy theo mô tả quản trị nhập', () => {
  const window = loadPage();
  const links = logoLinks(window);

  window.applyLogo({
    logo_image_url: 'https://res.cloudinary.com/demo/image/upload/dha/settings/logo.png',
    logo_alt: 'Kim Loại Màu DHA',
  });

  for (const link of links) {
    const img = link.querySelector('img.logo-img');
    assert.ok(img, 'ảnh logo được chèn vào');
    assert.equal(img.getAttribute('src'), 'https://res.cloudinary.com/demo/image/upload/dha/settings/logo.png');
    assert.equal(img.getAttribute('alt'), 'Kim Loại Màu DHA');
    assert.ok(link.classList.contains('logo-has-image'), 'thẻ logo được đánh dấu đang dùng ảnh');
    // Chữ vẫn nằm trong DOM để còn rơi về được khi ảnh hỏng.
    assert.ok(link.querySelector('.logo-accent'), 'logo chữ vẫn còn trong DOM');
  }
});

test('không nhập mô tả ảnh thì alt ghép từ logo chữ, không để trống', () => {
  const window = loadPage();
  const [link] = logoLinks(window);

  window.applyLogo({
    logo_image_url: '/assets/logo.png',
    logo_text_accent: 'DHA',
    logo_text_main: 'MINERALS',
  });

  assert.equal(link.querySelector('img.logo-img').getAttribute('alt'), 'DHA MINERALS');
});

test('áp lại nhiều lần không nhân đôi ảnh logo', () => {
  const window = loadPage();
  const [link] = logoLinks(window);

  window.applyLogo({ logo_image_url: '/assets/logo.png' });
  window.applyLogo({ logo_image_url: '/assets/logo-moi.png' });

  assert.equal(link.querySelectorAll('img.logo-img').length, 1);
  assert.equal(link.querySelector('img.logo-img').getAttribute('src'), '/assets/logo-moi.png');
});

test('chân trang dùng ảnh logo nền tối khi quản trị có đặt riêng', () => {
  const window = loadPage();
  const [header, footer] = logoLinks(window);

  window.applyLogo({
    logo_image_url: '/assets/logo-sang.png',
    logo_image_dark_url: '/assets/logo-toi.png',
  });

  assert.equal(header.querySelector('img.logo-img').getAttribute('src'), '/assets/logo-sang.png');
  assert.equal(footer.querySelector('img.logo-img').getAttribute('src'), '/assets/logo-toi.png');
  assert.ok(footer.closest('.footer'), 'logo thứ hai đúng là logo chân trang');
});

test('không đặt ảnh nền tối thì chân trang dùng lại ảnh logo chính', () => {
  const window = loadPage();
  const [header, footer] = logoLinks(window);

  window.applyLogo({ logo_image_url: '/assets/logo-sang.png', logo_image_dark_url: '   ' });

  assert.equal(header.querySelector('img.logo-img').getAttribute('src'), '/assets/logo-sang.png');
  assert.equal(footer.querySelector('img.logo-img').getAttribute('src'), '/assets/logo-sang.png');
});

test('chỉ có ảnh nền tối thì header vẫn về logo chữ, không mượn ảnh chân trang', () => {
  const window = loadPage();
  const [header, footer] = logoLinks(window);

  window.applyLogo({ logo_image_dark_url: '/assets/logo-toi.png' });

  assert.equal(header.querySelector('img.logo-img'), null, 'header không dùng ảnh dành cho nền tối');
  assert.ok(!header.classList.contains('logo-has-image'));
  assert.equal(footer.querySelector('img.logo-img').getAttribute('src'), '/assets/logo-toi.png');
});

test('gỡ ảnh trong quản trị thì website quay lại logo chữ', () => {
  const window = loadPage();
  const [link] = logoLinks(window);

  window.applyLogo({ logo_image_url: '/assets/logo.png', logo_image_dark_url: '/assets/logo-toi.png' });
  window.applyLogo({ logo_image_url: '', logo_image_dark_url: '' });

  for (const each of logoLinks(window)) {
    assert.equal(each.querySelector('img.logo-img'), null);
    assert.ok(!each.classList.contains('logo-has-image'), 'bỏ dấu đang dùng ảnh');
  }
  assert.equal(link.querySelector('.logo-accent').textContent, 'DHA');
});

test('ảnh logo hỏng đường dẫn thì rơi về logo chữ thay vì để trống đầu trang', () => {
  const window = loadPage();
  const [link] = logoLinks(window);

  window.applyLogo({ logo_image_url: '/assets/khong-ton-tai.png' });
  const img = link.querySelector('img.logo-img');
  assert.ok(img, 'ảnh được chèn trước khi lỗi');

  img.dispatchEvent(new window.Event('error'));

  assert.equal(link.querySelector('img.logo-img'), null);
  assert.ok(!link.classList.contains('logo-has-image'));
});

test('favicon do quản trị đặt thay hẳn favicon tĩnh trong HTML', () => {
  const window = loadPage();
  const head = window.document.head;
  assert.ok(head.querySelectorAll('link[rel~="icon"]').length >= 1, 'trang có favicon tĩnh làm dự phòng');

  window.applyFavicon({ favicon_url: 'https://res.cloudinary.com/demo/image/upload/dha/settings/icon.png' });

  const icons = [...head.querySelectorAll('link[rel~="icon"]')];
  assert.equal(icons.length, 1, 'chỉ còn đúng một thẻ icon, không để trình duyệt tự chọn');
  assert.equal(icons[0].getAttribute('href'), 'https://res.cloudinary.com/demo/image/upload/dha/settings/icon.png');
  assert.equal(icons[0].getAttribute('type'), 'image/png');
});

test('bỏ favicon trong quản trị thì trả lại favicon mặc định của website', () => {
  const window = loadPage();
  const head = window.document.head;
  const original = [...head.querySelectorAll('link[rel~="icon"]')].map((link) => link.getAttribute('href'));

  window.applyFavicon({ favicon_url: '/uploads/icon.svg' });
  window.applyFavicon({ favicon_url: '' });

  const restored = [...head.querySelectorAll('link[rel~="icon"]')].map((link) => link.getAttribute('href'));
  assert.deepEqual(restored, original);
  assert.equal(head.querySelector('link[data-site-favicon]'), null, 'thẻ do JS thêm đã được gỡ');
});

test('đổi favicon nhiều lần không đẻ thêm thẻ link', () => {
  const window = loadPage();

  window.applyFavicon({ favicon_url: '/uploads/a.png' });
  window.applyFavicon({ favicon_url: '/uploads/b.svg' });

  const icons = [...window.document.head.querySelectorAll('link[rel~="icon"]')];
  assert.equal(icons.length, 1);
  assert.equal(icons[0].getAttribute('href'), '/uploads/b.svg');
  assert.equal(icons[0].getAttribute('type'), 'image/svg+xml', 'type đổi theo đuôi file mới');
});

test('type của favicon suy đúng từ đuôi file, kể cả khi URL có tham số', () => {
  const window = loadPage();

  window.applyFavicon({ favicon_url: 'https://res.cloudinary.com/demo/icon.ico?v=3' });
  assert.equal(window.document.querySelector('link[data-site-favicon]').getAttribute('type'), 'image/x-icon');

  window.applyFavicon({ favicon_url: 'https://res.cloudinary.com/demo/icon-khong-duoi' });
  assert.equal(window.document.querySelector('link[data-site-favicon]').getAttribute('type'), null);
});

test('CSS ẩn logo chữ khi đang dùng ảnh', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(css, /\.logo-has-image \.logo-accent,\s*\n\.logo-has-image \.logo-text \{\s*\n\s*display: none;/);
  assert.match(css, /\.logo-img \{/);
});

test('câu ghi chú quanh bảng giá lấy chữ từ cài đặt, bỏ trống thì giữ chữ trong HTML', () => {
  const window = loadPage();
  const note = window.document.querySelector('[data-site-text="price_note_home"]');
  const original = note.textContent;

  window.applySiteTexts({});
  assert.equal(note.textContent, original, 'CMS bỏ trống thì giữ nguyên chữ dự phòng');

  window.applySiteTexts({ price_note_home: '* Giá cập nhật hằng ngày.' });
  assert.equal(note.textContent, '* Giá cập nhật hằng ngày.');
});

test('chữ thay cho giá và đơn vị giá theo đúng thứ tự ưu tiên', () => {
  const window = loadPage();

  window.__siteSettings = {};
  assert.equal(window.getProductPriceLabel({ price_on_request: true }).text, 'Liên hệ');
  assert.equal(window.getProductPriceLabel({ price: 285000 }).text, '285.000đ/kg');

  window.__siteSettings = { price_contact_text: 'Báo giá theo lô', price_unit_default: 'đ/tấn' };
  assert.equal(window.getProductPriceLabel({ price_on_request: true }).text, 'Báo giá theo lô');
  assert.equal(window.getProductPriceLabel({ price: 285000 }).text, '285.000đ/tấn');

  // Khai báo riêng của sản phẩm luôn thắng mặc định chung.
  assert.equal(
    window.getProductPriceLabel({ price_on_request: true, price_label: 'Liên hệ kỹ sư' }).text,
    'Liên hệ kỹ sư',
  );
  assert.equal(window.getProductPriceLabel({ price: 285000, price_unit: 'đ/kg' }).text, '285.000đ/kg');

  // Sản phẩm chưa nhập giá cũng dùng chữ thay thế, không hiện "0đ".
  assert.equal(window.getProductPriceLabel({}).text, 'Báo giá theo lô');
});

// ── Chớp nội dung cũ khi tải lại trang ──
// HTML tĩnh hard-code sẵn hotline/câu chữ mặc định, còn dữ liệu thật chỉ về sau
// khi CMS trả lời. Vì vậy mỗi lần refresh khách thấy nội dung cũ nhấp nháy rồi
// mới bị thay. Bộ nhớ đệm của lần tải trước phải được áp ngay khi app.js chạy.
const SITE_SETTINGS_CACHE_KEY = 'dha:site-settings:v1';

// Khác loadPage: gieo sẵn bộ nhớ đệm và để CMS treo mãi không trả lời, đúng
// cảnh khoảnh khắc đầu tiên sau khi refresh.
function loadPageWithCache(cached, file = 'index.html') {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (err) => errors.push(err));
  const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'), {
    runScripts: 'dangerously',
    url: 'https://dhakimloaimau.vn/',
    virtualConsole,
  });
  const { window } = dom;
  window.__scriptErrors = errors;
  window.localStorage.setItem(SITE_SETTINGS_CACHE_KEY, JSON.stringify(cached));
  window.fetch = () => new Promise(() => {});
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);
  return window;
}

test('tải lại trang thì hotline hiện ngay theo bộ nhớ đệm, không chớp số cũ', () => {
  const window = loadPageWithCache({ hotline: '0912.345.678', email: 'moi@dha.vn' });

  const hotlines = [...window.document.querySelectorAll('.site-hotline')];
  assert.ok(hotlines.length >= 2, 'trang chủ có hotline ở header và chân trang');
  for (const el of hotlines) {
    assert.equal(el.textContent, '0912.345.678');
  }
  assert.equal(window.document.querySelector('a.site-hotline').getAttribute('href'), 'tel:0912345678');
});

test('câu chữ do quản trị đặt cũng hiện ngay từ bộ nhớ đệm', () => {
  const window = loadPageWithCache({ hotline: '0912345678', price_intro_home: 'Giá cập nhật mỗi sáng.' });

  assert.equal(
    window.document.querySelector('[data-site-text="price_intro_home"]').textContent,
    'Giá cập nhật mỗi sáng.',
  );
});

test('bộ nhớ đệm hỏng thì trang vẫn chạy bình thường', () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    runScripts: 'dangerously',
    url: 'https://dhakimloaimau.vn/',
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.localStorage.setItem(SITE_SETTINGS_CACHE_KEY, '{khong-phai-json');
  window.fetch = () => new Promise(() => {});
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);

  assert.equal(typeof window.applyLogo, 'function', 'app.js chạy trọn vẹn dù bộ nhớ đệm hỏng');
});

test('dữ liệu CMS về thì được ghi lại vào bộ nhớ đệm cho lần tải sau', async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    runScripts: 'dangerously',
    url: 'https://dhakimloaimau.vn/',
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = (url) =>
    String(url).includes('/api/site-setting')
      ? Promise.resolve({ ok: true, json: async () => ({ data: { hotline: '0988777666' } }) })
      : Promise.reject(new Error('network disabled in tests'));
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);

  await window.initSiteSettings();

  const cached = JSON.parse(window.localStorage.getItem(SITE_SETTINGS_CACHE_KEY));
  assert.equal(cached.hotline, '0988777666');
});

// Áp bộ nhớ đệm sớm nghĩa là chạy mã ở phạm vi ngoài cùng của app.js; đặt lời
// gọi trước chỗ khai báo hằng nào đó sẽ làm cả tệp chết giữa chừng mà trang vẫn
// trông gần như bình thường.
test('áp bộ nhớ đệm không làm app.js chết giữa chừng', () => {
  const window = loadPageWithCache({ hotline: '0912345678', favicon_url: '/assets/icon.png' });

  assert.deepEqual(
    window.__scriptErrors.map((err) => err.message || String(err)),
    [],
    'app.js chạy hết mà không ném lỗi',
  );
  // Hằng khai báo gần cuối tệp: chỉ tồn tại nếu app.js chạy trọn vẹn.
  assert.doesNotThrow(() => window.eval('ARTICLE_CATEGORY_LABELS'));
});
