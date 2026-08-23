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

test('gỡ ảnh trong quản trị thì website quay lại logo chữ', () => {
  const window = loadPage();
  const [link] = logoLinks(window);

  window.applyLogo({ logo_image_url: '/assets/logo.png' });
  window.applyLogo({ logo_image_url: '' });

  assert.equal(link.querySelector('img.logo-img'), null);
  assert.ok(!link.classList.contains('logo-has-image'), 'bỏ dấu đang dùng ảnh');
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
