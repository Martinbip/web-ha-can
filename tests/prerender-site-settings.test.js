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
const os = require('node:os');
const {
  applySettingsToHtml,
  applyCategoriesToHtml,
  applyNavigationToHtml,
  applyPageContentToHtml,
  pageCodeFromHtml,
  renderPageList,
  renderCategoryLinks,
  renderFooterLinks,
  pickVisibleCategories,
  pagePathForFile,
  prerenderDirectory,
  safeUrl,
  DEFAULT_CATEGORIES,
} = require('../scripts/prerender-site-settings.js');

// Có một mục bị ẩn và một mục mang ký tự đặc biệt để thử escape.
const CATEGORIES = [
  { slug: 'kim-loai-mau', name: 'Kim Loại Màu', visible: true, sort_order: 1 },
  { slug: 'an-di', name: 'Ẩn đi', visible: false, sort_order: 2 },
  { slug: 'quang-&-mau', name: 'Quặng <Mẫu> & "Chuẩn"', visible: true, sort_order: 3 },
];

// Có menu con, một mục ẩn, một mục con ẩn và một URL độc hại.
const NAV_ITEMS = [
  { id: 'home', label: 'Trang Chủ', url: '/', visible: true, children: [] },
  {
    id: 'products',
    label: 'Sản Phẩm',
    url: '/products',
    visible: true,
    children: [
      { id: 'mau', label: 'Quặng <Mẫu>', url: '/products?filter=color-metal', visible: true },
      { id: 'an', label: 'Ẩn', url: '/an', visible: false },
    ],
  },
  { id: 'news', label: 'Tin Tức', url: '/news', visible: true, children: [] },
  { id: 'evil', label: 'Độc', url: 'javascript:alert(1)', visible: true, children: [] },
  { id: 'off', label: 'Tắt', url: '/off', visible: false, children: [] },
];

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
  hotline_box_title: 'GỌI KỸ SƯ',
  hotline_box_note: 'Phản hồi trong 15 phút\nHỗ trợ cả Chủ nhật',
  header_cta_label: 'Báo Giá Ngay',
  header_cta_url: '/pricing',
  footer_categories_title: 'DANH MỤC',
  footer_links_title: 'LIÊN KẾT NHANH',
  footer_links: [
    { label: 'Tin Tức', url: '/news', visible: true },
    { label: 'A & "B"', url: '/contact?x=1&y=2', visible: true },
  ],
  copyright_text: 'Công ty DHA.',
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
  '[data-category-list]',
  '.nav-links',
  '[data-footer-links]',
  '[data-copyright]',
  '.btn-contact',
  '[data-page-text]',
  '[data-page-list]',
  '[data-page-seo]',
  '[data-page-href]',
];

function snapshot(window) {
  return DYNAMIC_SELECTORS.map((selector) =>
    [...window.document.querySelectorAll(selector)].map((el) => el.outerHTML).join('\n'),
  );
}

function runAppJs(html, settings, categories = null, { url = 'https://dhakimloaimau.vn/', navigation = null, pageContent = null } = {}) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url,
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = (input) => {
    const target = String(input);
    if (target.includes('/api/site-setting')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: settings }) });
    }
    if (categories && target.includes('/api/product-categories')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: categories }) });
    }
    if (navigation && target.includes('/api/navigation')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: { items: navigation } }) });
    }
    if (pageContent && target.includes('/api/page-content')) {
      return Promise.resolve({ ok: true, json: async () => ({ data: pageContent }) });
    }
    return Promise.reject(new Error('network disabled in tests'));
  };
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
    const pagePath = pagePathForFile(file);
    const html = applyPageContentToHtml(
      applyNavigationToHtml(
        applyCategoriesToHtml(applySettingsToHtml(readPage(file), SETTINGS), CATEGORIES),
        NAV_ITEMS,
        pagePath,
      ),
      PAGE_CONTENT,
      file,
    );
    const window = runAppJs(html, SETTINGS, CATEGORIES, {
      url: `https://dhakimloaimau.vn${pagePath}`,
      navigation: NAV_ITEMS,
      pageContent: PAGE_CONTENT,
    });

    const before = snapshot(window);
    await window.initSiteSettings();
    await window.initCategoryLinks();
    await window.initNavigationMenu();
    await window.initPageContent();
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
  const window = runAppJs(applySettingsToHtml(readPage('contact.html'), partial), partial, null, {
    url: 'https://dhakimloaimau.vn/contact',
  });

  const before = snapshot(window);
  await window.initSiteSettings();
  const after = snapshot(window);

  for (const [index, selector] of DYNAMIC_SELECTORS.entries()) {
    assert.equal(after[index], before[index], `${selector} bị app.js xóa trắng → còn chớp`);
  }
});

test('mô tả khung hotline giữ nguyên chỗ xuống dòng khi prerender', () => {
  const note = 'Dòng một\nDòng hai';
  const html = applySettingsToHtml(readPage('index.html'), { hotline: '0912345678', hotline_box_note: note });
  const box = new JSDOM(html).window.document.querySelector('.widget-hotline-desc');
  assert.equal(box.textContent, note);
});

const LIST_HTML =
  '<footer><ul class="footer-list" data-category-list><li><a href="/products?filter=dong">Đồng</a></li></ul></footer>';

test('danh sách danh mục ghi đúng thứ tự, bỏ mục ẩn, escape tên và mã', () => {
  const html = applyCategoriesToHtml(LIST_HTML, CATEGORIES);
  const links = [...new JSDOM(html).window.document.querySelectorAll('[data-category-list] a')];

  assert.deepEqual(
    links.map((a) => a.getAttribute('href')),
    ['/products?filter=kim-loai-mau', '/products?filter=quang-%26-mau'],
  );
  assert.deepEqual(links.map((a) => a.textContent), ['Kim Loại Màu', 'Quặng <Mẫu> & "Chuẩn"']);
  assert.ok(!html.includes('<Mẫu>'), 'tên danh mục không lọt thành thẻ HTML');
  assert.ok(!html.includes('filter=dong'), 'mục cũ đã bị thay');
});

test('không còn danh mục hiển thị thì dùng 3 danh mục mặc định', () => {
  assert.deepEqual(pickVisibleCategories([{ slug: 'a', name: 'A', visible: false }]), DEFAULT_CATEGORIES);
  assert.deepEqual(pickVisibleCategories([]), DEFAULT_CATEGORIES);
  assert.deepEqual(pickVisibleCategories(null), DEFAULT_CATEGORIES);
});

test('danh mục mặc định của prerender khớp data/product_categories.json', () => {
  const fallback = JSON.parse(readPage('data/product_categories.json'));
  assert.deepEqual(DEFAULT_CATEGORIES, fallback.map(({ slug, name }) => ({ slug, name })));
});

test('thanh tab được ghi sẵn tên danh mục, nút Tất Cả luôn đứng đầu', () => {
  const html = applyCategoriesToHtml(
    '<nav id="home-filter-tabs"><button class="home-filter-btn active" data-filter="all">Tất Cả <em></em></button></nav>'
      + '<div id="product-filter-tabs"></div>',
    CATEGORIES,
  );
  const doc = new JSDOM(html).window.document;

  const home = [...doc.querySelectorAll('#home-filter-tabs button')];
  assert.deepEqual(home.map((b) => b.dataset.filter), ['all', 'kim-loai-mau', 'quang-&-mau']);
  assert.ok(home[0].classList.contains('active'));
  assert.equal(home[0].getAttribute('aria-selected'), 'true');
  assert.equal(home[1].getAttribute('aria-selected'), 'false');
  assert.ok(home[1].classList.contains('home-filter-btn'));
  assert.ok(home[1].querySelector('em'), 'chừa chỗ cho số lượng');
  assert.equal(home[2].firstChild.textContent.trim(), 'Quặng <Mẫu> & "Chuẩn"');

  const product = [...doc.querySelectorAll('#product-filter-tabs button')];
  assert.equal(product.length, 3);
  assert.ok(product[1].classList.contains('product-filter-btn'));
  assert.ok(product[1].querySelector('.filter-count'));
});

test('ghi danh mục nhiều lần cho ra cùng một kết quả', () => {
  const once = applyCategoriesToHtml(LIST_HTML, CATEGORIES);
  assert.equal(applyCategoriesToHtml(once, CATEGORIES), once);
});

test('đọc danh mục lỗi thì vẫn ghi cài đặt, và ngược lại', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-'));
  const file = path.join(dir, 'a.html');
  const page = '<span class="site-hotline">000</span><ul data-category-list><li>cũ</li></ul>';
  const quiet = { warn() {} };
  const fail = async () => {
    throw new Error('CMS trả về 500');
  };

  try {
    fs.writeFileSync(file, page);
    await prerenderDirectory(dir, { loadSettings: async () => ({ hotline: '0912345678' }), loadCategories: fail, loadNavigation: fail, log: quiet });
    let out = fs.readFileSync(file, 'utf8');
    assert.ok(out.includes('0912345678'), 'cài đặt vẫn được ghi');
    assert.ok(out.includes('<li>cũ</li>'), 'danh mục giữ nguyên khi đọc lỗi');

    fs.writeFileSync(file, page);
    await prerenderDirectory(dir, { loadSettings: fail, loadCategories: async () => CATEGORIES, loadNavigation: fail, log: quiet });
    out = fs.readFileSync(file, 'utf8');
    assert.ok(out.includes('/products?filter=kim-loai-mau'), 'danh mục vẫn được ghi');
    assert.ok(out.includes('>000<'), 'cài đặt giữ nguyên khi đọc lỗi');

    await assert.rejects(prerenderDirectory(dir, { loadSettings: fail, loadCategories: fail, loadNavigation: fail, log: quiet }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Bản sao sang realm của test để so sánh — mảng tạo trong jsdom mang prototype khác.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('app.js dựng danh sách danh mục ra cùng một DOM với prerender', () => {
  const window = runAppJs(readPage('index.html'), SETTINGS);
  const visible = pickVisibleCategories(CATEGORIES);
  const fromJs = window.document.createElement('ul');
  fromJs.innerHTML = window.renderCategoryLinks(visible);
  const fromPrerender = window.document.createElement('ul');
  fromPrerender.innerHTML = renderCategoryLinks(visible);

  assert.equal(fromJs.innerHTML, fromPrerender.innerHTML);
});

test('app.js và prerender dùng chung quy tắc chọn danh mục', () => {
  const window = runAppJs(readPage('index.html'), SETTINGS);
  assert.deepEqual(plain(window.eval('DEFAULT_PRODUCT_CATEGORIES')), DEFAULT_CATEGORIES);
  for (const items of [CATEGORIES, [], [{ slug: 'x', name: 'X', visible: false }]]) {
    assert.deepEqual(plain(window.pickVisibleCategories(items)), plain(pickVisibleCategories(items)));
  }
});

test('CMS lỗi thì app.js giữ nguyên danh sách danh mục đã prerender', async () => {
  const html = applyCategoriesToHtml(readPage('index.html'), CATEGORIES);
  const window = runAppJs(html, SETTINGS); // không trả danh mục = CMS lỗi
  const lists = () => [...window.document.querySelectorAll('[data-category-list]')].map((el) => el.outerHTML);

  const before = lists();
  await window.initCategoryLinks();

  assert.deepEqual(lists(), before);
  assert.ok(before[0].includes('filter=kim-loai-mau'), 'vẫn là bản prerender, không phải file dự phòng');
});

test('CMS trả lời thì app.js thay danh sách mặc định bằng danh mục thật', async () => {
  const window = runAppJs(readPage('contact.html'), SETTINGS, CATEGORIES);
  await window.initCategoryLinks();

  const hrefs = [...window.document.querySelectorAll('footer [data-category-list] a')].map((a) => a.getAttribute('href'));
  assert.deepEqual(hrefs, ['/products?filter=kim-loai-mau', '/products?filter=quang-%26-mau']);
});

test('CMS lỗi thì tab lọc dùng danh mục prerender đã ghi sẵn', async () => {
  const html = applyCategoriesToHtml(readPage('products.html'), CATEGORIES);
  const window = runAppJs(html, SETTINGS);

  const tabs = await window.resolveTabCategories(window.document.getElementById('product-filter-tabs'));

  assert.deepEqual(plain(tabs), [
    { slug: 'kim-loai-mau', name: 'Kim Loại Màu' },
    { slug: 'quang-&-mau', name: 'Quặng <Mẫu> & "Chuẩn"' },
  ]);
});

test('CMS lỗi và HTML chưa prerender thì tab lọc dùng danh mục mặc định', async () => {
  const window = runAppJs(readPage('products.html'), SETTINGS);
  const tabs = await window.resolveTabCategories(window.document.getElementById('product-filter-tabs'));
  assert.deepEqual(plain(tabs).map((tab) => tab.slug), ['color-metal', 'black-metal', 'rare-earth']);
});

const NAV_HTML = '<nav class="main-navigation"><ul class="nav-links"><li><a href="/" class="nav-link active">Cũ</a></li></ul></nav>';

function navDoc(items, currentPath) {
  return new JSDOM(applyNavigationToHtml(NAV_HTML, items, currentPath)).window.document;
}

test('menu được ghi sẵn: bỏ mục ẩn và URL độc hại, giữ menu con', () => {
  const doc = navDoc(NAV_ITEMS, '/news');
  const top = [...doc.querySelectorAll('.nav-links > li > a.nav-link')].map((a) => [a.textContent, a.getAttribute('href')]);
  assert.deepEqual(top, [['Trang Chủ', '/'], ['Sản Phẩm', '/products'], ['Tin Tức', '/news']]);

  const sub = [...doc.querySelectorAll('.nav-submenu a')];
  assert.equal(sub.length, 1, 'mục con ẩn bị bỏ');
  assert.equal(sub[0].textContent, 'Quặng <Mẫu>');
  assert.ok(sub[0].classList.contains('nav-sublink'));
  assert.equal(doc.querySelector('.has-submenu .nav-submenu-toggle').getAttribute('aria-label'), 'Mở menu con Sản Phẩm');
  assert.ok(!doc.body.innerHTML.includes('javascript:'), 'URL độc hại không lọt vào HTML');
});

test('menu đánh dấu đúng mục đang xem theo trang', () => {
  const active = (items, currentPath) =>
    [...navDoc(items, currentPath).querySelectorAll('.nav-link.active')].map((a) => a.getAttribute('href'));

  assert.deepEqual(active(NAV_ITEMS, '/'), ['/']);
  assert.deepEqual(active(NAV_ITEMS, '/news'), ['/news']);
  assert.deepEqual(active(NAV_ITEMS, '/products'), ['/products']);
  assert.deepEqual(active(NAV_ITEMS, '/contact'), [], 'không mục nào khớp thì không đánh dấu');

  const nested = [{ label: 'Giới Thiệu', url: '/#services', children: [{ label: 'Dự Án', url: '/projects' }] }];
  assert.deepEqual(active(nested, '/projects'), ['/#services', '/projects'], 'mục con khớp thì làm sáng cả mục cha');
});

test('menu rỗng hoặc toàn mục hỏng thì giữ nguyên HTML', () => {
  assert.equal(applyNavigationToHtml(NAV_HTML, [], '/'), NAV_HTML);
  assert.equal(applyNavigationToHtml(NAV_HTML, [{ label: 'Độc', url: 'javascript:1' }], '/'), NAV_HTML);
  assert.equal(applyNavigationToHtml(NAV_HTML, null, '/'), NAV_HTML);
});

test('đường dẫn trang suy từ tên file', () => {
  assert.equal(pagePathForFile('index.html'), '/');
  assert.equal(pagePathForFile('products.html'), '/products');
  assert.equal(pagePathForFile('news-detail.html'), '/news-detail');
});

const CHROME_HTML =
  '<header><a href="/contact" class="btn-contact" data-site-text="header_cta_label">Yêu Cầu Mẫu</a></header>'
  + '<footer><h4 data-site-text="footer_links_title">HỖ TRỢ</h4>'
  + '<ul class="footer-list" data-footer-links><li><a href="/cu">Cũ</a></li></ul>'
  + '<p class="copyright" data-copyright>&copy; 2026 Cũ</p></footer>';

test('liên kết chân trang, bản quyền và nút đầu trang lấy từ cài đặt', () => {
  const html = applySettingsToHtml(
    CHROME_HTML,
    {
      header_cta_label: 'Báo Giá Ngay',
      header_cta_url: '/pricing',
      footer_links_title: 'LIÊN KẾT',
      footer_links: [
        { label: 'Tin <Mới>', url: '/news', visible: true },
        { label: 'Ẩn', url: '/x', visible: false },
        { label: 'Độc', url: 'javascript:alert(1)', visible: true },
        { label: '', url: '/y' },
        { label: 'Ngoài', url: 'https://example.com/a?b=1&c=2', visible: true },
      ],
      copyright_text: 'Công ty <DHA>.',
    },
    { year: 2031 },
  );
  const doc = new JSDOM(html).window.document;

  const cta = doc.querySelector('.btn-contact');
  assert.equal(cta.textContent, 'Báo Giá Ngay');
  assert.equal(cta.getAttribute('href'), '/pricing');
  assert.equal(doc.querySelector('[data-site-text="footer_links_title"]').textContent, 'LIÊN KẾT');
  assert.deepEqual(
    [...doc.querySelectorAll('[data-footer-links] a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [['Tin <Mới>', '/news'], ['Ngoài', 'https://example.com/a?b=1&c=2']],
  );
  assert.equal(doc.querySelector('[data-copyright]').textContent, '© 2031 Công ty <DHA>.');
  assert.ok(!html.includes('javascript:'), 'URL độc hại không lọt vào HTML');
});

test('cài đặt bỏ trống hoặc hỏng thì giữ nguyên chân trang và nút đầu trang', () => {
  const out = applySettingsToHtml(CHROME_HTML, {
    footer_links: [{ label: 'Ẩn', url: '/x', visible: false }],
    header_cta_url: 'javascript:alert(1)',
  });
  assert.equal(out, CHROME_HTML);
});

test('renderFooterLinks trả chuỗi rỗng khi dữ liệu không phải mảng', () => {
  for (const value of [null, undefined, 'chuoi', { label: 'A', url: '/a' }]) {
    assert.equal(renderFooterLinks(value), '');
  }
});

test('ghi menu theo từng trang trong thư mục', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-nav-'));
  const quiet = { warn() {} };
  const fail = async () => {
    throw new Error('CMS trả về 500');
  };
  try {
    fs.writeFileSync(path.join(dir, 'index.html'), NAV_HTML);
    fs.writeFileSync(path.join(dir, 'news.html'), NAV_HTML);
    const result = await prerenderDirectory(dir, {
      loadSettings: fail,
      loadCategories: fail,
      loadNavigation: async () => NAV_ITEMS,
      log: quiet,
    });
    assert.equal(result.navigation, true);
    const activeIn = (file) =>
      [...new JSDOM(fs.readFileSync(path.join(dir, file), 'utf8')).window.document.querySelectorAll('.nav-link.active')]
        .map((a) => a.getAttribute('href'));
    assert.deepEqual(activeIn('index.html'), ['/']);
    assert.deepEqual(activeIn('news.html'), ['/news']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cả bốn nguồn cùng lỗi thì báo đủ bốn lý do', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-fail-'));
  const reason = (label) => async () => {
    throw new Error(`hỏng ${label}`);
  };
  try {
    await assert.rejects(
      prerenderDirectory(dir, {
        loadSettings: reason('A'),
        loadCategories: reason('B'),
        loadNavigation: reason('C'),
        loadPageContent: reason('D'),
        log: { warn() {} },
      }),
      (err) =>
        /cài đặt website: hỏng A/.test(err.message)
        && /danh mục: hỏng B/.test(err.message)
        && /menu: hỏng C/.test(err.message)
        && /nội dung trang: hỏng D/.test(err.message),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('app.js dựng liên kết chân trang ra cùng một DOM với prerender', () => {
  const window = runAppJs(readPage('index.html'), SETTINGS);
  const items = [
    { label: 'A & "B" <c>', url: '/a?x=1&y=2', visible: true },
    { label: 'Ẩn', url: '/x', visible: false },
    { label: 'Độc', url: 'javascript:alert(1)', visible: true },
  ];
  const fromJs = window.document.createElement('ul');
  fromJs.innerHTML = window.renderFooterLinks(items);
  const fromPrerender = window.document.createElement('ul');
  fromPrerender.innerHTML = renderFooterLinks(items);

  assert.equal(fromJs.innerHTML, fromPrerender.innerHTML);
  assert.equal(fromJs.children.length, 1);
});

test('app.js áp liên kết chân trang, bản quyền và link nút đầu trang từ cài đặt', async () => {
  const window = runAppJs(readPage('contact.html'), SETTINGS, null, { url: 'https://dhakimloaimau.vn/contact' });
  await window.initSiteSettings();
  const doc = window.document;

  assert.deepEqual(
    [...doc.querySelectorAll('[data-footer-links] a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [['Tin Tức', '/news'], ['A & "B"', '/contact?x=1&y=2']],
  );
  assert.equal(doc.querySelector('[data-copyright]').textContent, `© ${new Date().getFullYear()} Công ty DHA.`);
  assert.equal(doc.querySelector('.btn-contact').getAttribute('href'), '/pricing');
  assert.equal(doc.querySelector('.btn-contact').textContent, 'Báo Giá Ngay');
});

test('cài đặt bỏ trống thì app.js giữ nguyên chân trang và nút đầu trang', async () => {
  const partial = { hotline: '0912345678', header_cta_url: 'javascript:alert(1)', footer_links: [] };
  const window = runAppJs(readPage('news.html'), partial, null, { url: 'https://dhakimloaimau.vn/news' });
  const pick = () => ['[data-footer-links]', '[data-copyright]', '.btn-contact'].map((s) => window.document.querySelector(s).outerHTML);

  const before = pick();
  await window.initSiteSettings();
  assert.deepEqual(pick(), before);
});

test('CMS lỗi thì app.js giữ menu đã prerender', async () => {
  const html = applyNavigationToHtml(readPage('news.html'), NAV_ITEMS, '/news');
  const window = runAppJs(html, SETTINGS, null, { url: 'https://dhakimloaimau.vn/news' }); // không trả menu = CMS lỗi
  const before = window.document.querySelector('.nav-links').outerHTML;

  await window.initNavigationMenu();

  assert.equal(window.document.querySelector('.nav-links').outerHTML, before);
  assert.ok(before.includes('Quặng &lt;Mẫu&gt;'), 'vẫn là menu prerender, không phải menu tĩnh');
});

test('CMS lỗi thì menu con đã prerender vẫn mở được bằng nút', async () => {
  const html = applyNavigationToHtml(readPage('news.html'), NAV_ITEMS, '/news');
  const window = runAppJs(html, SETTINGS, null, { url: 'https://dhakimloaimau.vn/news' }); // không trả menu = CMS lỗi
  await window.initNavigationMenu();
  await window.initNavigationMenu(); // lần gọi thứ hai không được gắn thêm sự kiện

  const toggle = window.document.querySelector('.has-submenu .nav-submenu-toggle');
  toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  assert.ok(toggle.closest('.has-submenu').classList.contains('submenu-open'), 'bấm một lần là mở menu con');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
});

test('quy tắc URL khớp nhau giữa app.js và prerender', () => {
  const window = runAppJs(readPage('news.html'), SETTINGS, null, { url: 'https://dhakimloaimau.vn/news' });
  const cases = [
    ['/ok', '/ok'],
    ['#x', '#x'],
    ['https://dha.vn/a?b=1', 'https://dha.vn/a?b=1'],
    ['//evil.com', ''],
    ['/\\evil.com', ''],
    ['https://a b', ''],
    ['javascript:alert(1)', ''],
    ['', ''],
    ['  /spaced  ', '/spaced'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(window.safeNavUrl(input), safeUrl(input), `app.js và prerender phải khớp nhau cho ${JSON.stringify(input)}`);
    assert.equal(safeUrl(input), expected, `giá trị đúng kỳ vọng cho ${JSON.stringify(input)}`);
  }
});

test('chữ toàn khoảng trắng hoặc URL kiểu //... bị lọc khỏi liên kết chân trang ở cả hai nơi', () => {
  const window = runAppJs(readPage('news.html'), SETTINGS, null, { url: 'https://dhakimloaimau.vn/news' });
  const items = [
    { label: '   ', url: '/a' },
    { label: 'B', url: '//evil.com' },
  ];
  assert.equal(renderFooterLinks(items), '');
  assert.equal(window.renderFooterLinks(items), '');
});

test('prerender đọc bản mẫu ở nguồn rồi ghi sang đích', async () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-src-'));
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-dest-'));
  const template = '<html><body><span class="site-hotline">086.725.9078</span></body></html>';
  const quiet = { warn() {} };
  const noCms = async () => {
    throw new Error('không dùng');
  };
  try {
    fs.writeFileSync(path.join(src, 'index.html'), template);
    fs.writeFileSync(path.join(dest, 'index.html'), template);
    fs.writeFileSync(path.join(dest, 'sitemap.xml'), '<urlset/>');

    await prerenderDirectory(dest, {
      sourceDir: src,
      loadSettings: async () => ({ hotline: '0912345678' }),
      loadCategories: noCms,
      loadNavigation: noCms,
      log: quiet,
    });
    assert.match(fs.readFileSync(path.join(dest, 'index.html'), 'utf8'), /0912345678/);
    assert.equal(fs.readFileSync(path.join(src, 'index.html'), 'utf8'), template, 'bản mẫu ở nguồn không bị sửa');
    assert.equal(fs.readFileSync(path.join(dest, 'sitemap.xml'), 'utf8'), '<urlset/>', 'file không phải .html không bị đụng');

    // Ô bị xoá trắng trong admin: đích phải quay về chữ mặc định của bản mẫu.
    await prerenderDirectory(dest, {
      sourceDir: src,
      loadSettings: async () => ({ hotline: '' }),
      loadCategories: noCms,
      loadNavigation: noCms,
      log: quiet,
    });
    assert.equal(fs.readFileSync(path.join(dest, 'index.html'), 'utf8'), template, 'bỏ trống thì về lại bản mẫu');
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

test('thiếu thư mục nguồn thì báo lỗi rõ, không ghi gì', async () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-dest-'));
  try {
    await assert.rejects(
      prerenderDirectory(dest, {
        sourceDir: path.join(dest, 'khong-co-that'),
        loadSettings: async () => ({ hotline: '0912345678' }),
        loadCategories: async () => [],
        loadNavigation: async () => [],
        log: { warn() {} },
      }),
      /không tìm thấy|khong-co-that/i,
    );
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});

const PAGE_CONTENT = {
  texts: {
    home: {
      services_title: 'Dịch vụ <mới>',
      products_title: 'QUẶNG\nCHUẨN',
      hero_primary_label: 'Xem ngay',
      hero_primary_url: '/products?filter=color-metal',
    },
    contact: { commitments: ['Nhanh & gọn', '  ', 'Đúng hẹn'] },
  },
  seo: {
    home: { title: 'Tiêu đề Google', description: 'Mô tả Google', image: 'https://dha.vn/a.png', image_alt: 'Ảnh mẫu' },
    contact: { image: 'javascript:alert(1)' },
  },
};

const PAGE_HTML = '<html><head><title data-page-seo="title">Cũ</title>'
  + '<meta name="description" data-page-seo="description" content="Cũ">'
  + '<meta property="og:title" data-page-seo="title" content="Cũ">'
  + '<meta property="og:image" data-page-seo="image" content="/cu.png">'
  + '<meta property="og:image:alt" data-page-seo="image_alt" content="Cũ"></head>'
  + '<body data-page="home"><a href="/cu" data-page-text="hero_primary_label" data-page-href="hero_primary_url">Cũ</a>'
  + '<h2 data-page-text="products_title">CŨ</h2><p data-page-text="services_title">Cũ</p>'
  + '<p data-page-text="khong_co">Giữ nguyên</p></body></html>';

test('nội dung trang và SEO được ghi theo đúng mã trang', () => {
  const doc = new JSDOM(applyPageContentToHtml(PAGE_HTML, PAGE_CONTENT, 'index.html')).window.document;

  assert.equal(doc.querySelector('[data-page-text="services_title"]').textContent, 'Dịch vụ <mới>');
  assert.equal(doc.querySelector('[data-page-text="products_title"]').innerHTML, 'QUẶNG<br>CHUẨN');
  const link = doc.querySelector('[data-page-href="hero_primary_url"]');
  assert.equal(link.textContent, 'Xem ngay');
  assert.equal(link.getAttribute('href'), '/products?filter=color-metal');
  assert.equal(doc.querySelector('[data-page-text="khong_co"]').textContent, 'Giữ nguyên', 'khoá không có dữ liệu thì giữ HTML');

  assert.equal(doc.querySelector('title').textContent, 'Tiêu đề Google');
  assert.equal(doc.querySelector('meta[name="description"]').getAttribute('content'), 'Mô tả Google');
  assert.equal(doc.querySelector('meta[property="og:title"]').getAttribute('content'), 'Tiêu đề Google');
  assert.equal(doc.querySelector('meta[property="og:image"]').getAttribute('content'), 'https://dha.vn/a.png');
  assert.equal(doc.querySelector('meta[property="og:image:alt"]').getAttribute('content'), 'Ảnh mẫu');
});

test('danh sách trong trang: bỏ dòng trống, escape, hết dòng thì giữ HTML', () => {
  const html = '<body data-page="contact"><ul data-page-list="commitments"><li>Cũ</li></ul></body>';
  const doc = new JSDOM(applyPageContentToHtml(html, PAGE_CONTENT, 'contact.html')).window.document;
  assert.deepEqual([...doc.querySelectorAll('[data-page-list] li')].map((li) => li.textContent), ['Nhanh & gọn', 'Đúng hẹn']);

  const empty = applyPageContentToHtml(html, { texts: { contact: { commitments: ['  ', 42] } } }, 'contact.html');
  assert.equal(empty, html, 'không còn dòng dùng được thì giữ nguyên');
});

test('ảnh SEO sai quy tắc URL bị bỏ, trang không có dữ liệu thì giữ HTML', () => {
  const html = '<head><meta property="og:image" data-page-seo="image" content="/cu.png"></head><body data-page="contact"></body>';
  assert.equal(applyPageContentToHtml(html, PAGE_CONTENT, 'contact.html'), html);
  assert.equal(applyPageContentToHtml(PAGE_HTML, {}, 'index.html'), PAGE_HTML);
  assert.equal(applyPageContentToHtml(PAGE_HTML, null, 'index.html'), PAGE_HTML);
});

test('mã trang đọc từ thẻ body, thiếu thì suy từ tên file', () => {
  assert.equal(pageCodeFromHtml('<body data-page="pricing">', 'bat-ky.html'), 'pricing');
  assert.equal(pageCodeFromHtml('<body>', 'index.html'), 'home');
  assert.equal(pageCodeFromHtml('<body>', 'contact.html'), 'contact');
  assert.equal(pageCodeFromHtml('<body>', 'preview.html'), null);
});

test('nội dung trang là nguồn thứ tư, lỗi riêng nó không chặn ba nguồn kia', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prerender-page-'));
  const quiet = { warn() {} };
  try {
    fs.writeFileSync(path.join(dir, 'index.html'), PAGE_HTML);
    const result = await prerenderDirectory(dir, {
      sourceDir: dir,
      loadSettings: async () => ({ hotline: '0912345678' }),
      loadCategories: async () => [],
      loadNavigation: async () => [],
      loadPageContent: async () => {
        throw new Error('CMS 500');
      },
      log: quiet,
    });
    assert.equal(result.pageContent, false);
    assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /Cũ<\/title>/);

    await prerenderDirectory(dir, {
      sourceDir: dir,
      loadSettings: async () => ({ hotline: '0912345678' }),
      loadCategories: async () => [],
      loadNavigation: async () => [],
      loadPageContent: async () => PAGE_CONTENT,
      log: quiet,
    });
    assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /Tiêu đề Google<\/title>/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('app.js áp nội dung trang và SEO từ CMS', async () => {
  const window = runAppJs(readPage('index.html'), SETTINGS, null, {
    url: 'https://dhakimloaimau.vn/',
    pageContent: PAGE_CONTENT,
  });
  await window.initPageContent();
  const doc = window.document;

  assert.equal(doc.querySelector('[data-page-text="services_title"]').textContent, 'Dịch vụ <mới>');
  assert.equal(doc.querySelector('[data-page-text="products_title"]').innerHTML, 'QUẶNG<br>CHUẨN');
  assert.equal(doc.querySelector('[data-page-href="hero_primary_url"]').getAttribute('href'), '/products?filter=color-metal');
  assert.equal(doc.querySelector('title').textContent, 'Tiêu đề Google');
  assert.equal(doc.querySelector('meta[property="og:title"]').getAttribute('content'), 'Tiêu đề Google');
});

test('CMS lỗi hoặc ô trống thì app.js giữ nguyên nội dung trang đã có', async () => {
  const window = runAppJs(readPage('contact.html'), SETTINGS, null, { url: 'https://dhakimloaimau.vn/contact' });
  const pick = () => [...window.document.querySelectorAll('[data-page-text], [data-page-list], title')].map((el) => el.outerHTML);

  const before = pick();
  await window.initPageContent();
  assert.deepEqual(pick(), before);
});

test('app.js và prerender dựng danh sách trong trang ra cùng một DOM', () => {
  const window = runAppJs(readPage('contact.html'), SETTINGS);
  const items = ['A & "B"', '   ', '<script>'];
  const fromJs = window.document.createElement('ul');
  fromJs.innerHTML = window.renderPageList(items);
  const fromPrerender = window.document.createElement('ul');
  fromPrerender.innerHTML = renderPageList(items);

  assert.equal(fromJs.innerHTML, fromPrerender.innerHTML);
  assert.equal(fromJs.children.length, 2);
});

// initPageContent() gọi fetchSingleFromCMS('page-content') không kèm fallbackFile.
// Khi CMS lỗi, hàm không được rơi xuống nhánh dự phòng rồi gọi fetch(undefined).
test('CMS lỗi thì initPageContent không gọi fetch tới địa chỉ undefined', async () => {
  const window = runAppJs(readPage('index.html'), SETTINGS, null, { url: 'https://dhakimloaimau.vn/' });
  const calledUrls = [];
  const originalFetch = window.fetch;
  window.fetch = (input, ...rest) => {
    calledUrls.push(String(input));
    return originalFetch(input, ...rest);
  };

  await window.initPageContent();

  assert.ok(
    !calledUrls.some((url) => url.includes('undefined')),
    `không được gọi fetch tới địa chỉ chứa "undefined", đã gọi: ${JSON.stringify(calledUrls)}`,
  );
});

// product-detail.html và news-detail.html mang data-page (tiêu đề, mô tả do JS
// đặt theo từng sản phẩm/bài viết) nhưng không có dấu [data-page-*] nào — gọi
// CMS nội dung trang cho hai trang này là vô ích.
test('product-detail.html không có dấu data-page-* thì initPageContent không gọi CMS', async () => {
  const window = runAppJs(readPage('product-detail.html'), SETTINGS, null, { url: 'https://dhakimloaimau.vn/product-detail' });
  const calledUrls = [];
  const originalFetch = window.fetch;
  window.fetch = (input, ...rest) => {
    calledUrls.push(String(input));
    return originalFetch(input, ...rest);
  };

  await window.initPageContent();

  assert.ok(
    !calledUrls.some((url) => url.includes('/api/page-content')),
    `không được gọi CMS nội dung trang, đã gọi: ${JSON.stringify(calledUrls)}`,
  );
});
