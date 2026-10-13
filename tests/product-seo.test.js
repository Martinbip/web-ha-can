// SEO sản phẩm (2026-10-13): địa chỉ /san-pham/<mã>, trang tĩnh có dữ liệu
// Product, sitemap có sản phẩm, ô SEO trong admin — và lỗi bảng thông số không
// hiện vì admin lưu dạng object.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const products = require('../scripts/prerender-products');
const { buildSitemapXml } = require('../scripts/generate-sitemap');
const { prerenderDirectory } = require('../scripts/prerender-site-settings');

const CATHODE = {
  uid: 'dong-tam-cathode',
  name: 'Đồng Tấm Cathode',
  grade: '> 99,95% Cu',
  description: 'Đồng tấm cathode nhập khẩu, hàm lượng trên 99,95% Cu, dùng làm nguyên liệu kéo dây, đúc phôi và sản xuất hợp kim đồng cho nhà máy cơ khí, điện, điện tử trên toàn quốc.',
  specs: { 0: 'Hàm lượng: > 99,95% Cu', 1: 'Nguồn gốc: Nhập Khẩu', 2: 'Đóng gói: 125 kg/kiện' },
  image: 'https://res.cloudinary.com/x/cathode.jpg',
  price: 285000,
  price_unit: null,
  in_stock: true,
};

function openDetail(url, list) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'product-detail.html'), 'utf8'), {
    runScripts: 'dangerously',
    url,
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = (input) => (String(input).includes('/api/products')
    ? Promise.resolve({ ok: true, json: async () => ({ data: list }) })
    : Promise.reject(new Error('network disabled in tests')));
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);
  return window;
}

test('trang chi tiết đọc mã từ /san-pham/<mã> và hiện bảng thông số lưu dạng object', async () => {
  const window = openDetail('https://dhakimloaimau.vn/san-pham/dong-tam-cathode', [CATHODE]);
  await window.initProductDetailPage();
  const items = [...window.document.querySelectorAll('.detail-specs-list li')].map((li) => li.textContent);
  assert.deepEqual(items, ['Hàm lượng: > 99,95% Cu', 'Nguồn gốc: Nhập Khẩu', 'Đóng gói: 125 kg/kiện']);
  assert.equal(window.document.title, 'Đồng Tấm Cathode - DHA Minerals', 'tiêu đề không bị escape thành &amp;');
  assert.equal(window.document.getElementById('canonical-url').href, 'https://dhakimloaimau.vn/san-pham/dong-tam-cathode');
});

test('thông số: mảng cũ, object khoá số, object khoá chữ đều ra đúng dòng', () => {
  const window = openDetail('https://dhakimloaimau.vn/san-pham/x', []);
  // Mảng tạo trong jsdom thuộc realm khác — so qua JSON.
  const specs = (value) => JSON.parse(JSON.stringify(window.normalizeProductSpecs(value)));
  assert.deepEqual(specs(['A: 1', ' ', 'B']), ['A: 1', 'B']);
  assert.deepEqual(specs({ 0: 'A: 1', 1: '' }), ['A: 1']);
  assert.deepEqual(specs({ 'Hàm lượng': '99%' }), ['Hàm lượng: 99%']);
  assert.deepEqual(specs(null), []);
});

test('link sản phẩm dùng địa chỉ sạch; link cũ ?id= vẫn mở được', async () => {
  assert.match(APP_JS, /href="\$\{escapeHtml\(getProductUrl\(product\.uid\)\)\}" class="product-card card"/);
  const window = openDetail('https://dhakimloaimau.vn/product-detail?id=dong-tam-cathode', [CATHODE]);
  await window.initProductDetailPage();
  assert.equal(window.document.querySelector('.detail-title').textContent, 'Đồng Tấm Cathode');
  const html = fs.readFileSync(path.join(root, 'product-detail.html'), 'utf8');
  assert.doesNotMatch(html, /(src|href)="(?!\/|#|https?:|tel:|mailto:)[^"]+"/, 'không còn đường dẫn tương đối (hỏng khi ở /san-pham/<mã>)');
});

test('meta sản phẩm: trình duyệt và prerender ra cùng kết quả, mô tả dài được cắt ở ranh giới từ', () => {
  const window = openDetail('https://dhakimloaimau.vn/san-pham/x', []);
  const withSeo = { ...CATHODE, seo_title: 'Đồng cathode 99,95% Cu', seo_description: 'Mô tả SEO riêng' };
  const longDesc = { ...CATHODE, description: `${'đồng cathode '.repeat(30)}hết` };
  for (const product of [CATHODE, withSeo, longDesc]) {
    assert.deepEqual(JSON.parse(JSON.stringify(window.productMeta(product))), products.productMeta(product));
  }
  const cut = products.productMeta(longDesc).description;
  assert.ok(cut.length <= 160 && cut.endsWith('…') && !/\s…$/.test(cut), cut);
  assert.equal(products.productMeta(withSeo).title, 'Đồng cathode 99,95% Cu');
});

test('prerender ghi trang tĩnh /san-pham/<mã> có dữ liệu Product, dọn sản phẩm đã xoá, sitemap có sản phẩm', async () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'dha-products-'));
  fs.mkdirSync(path.join(target, 'san-pham', 'da-xoa'), { recursive: true });
  const empty = async () => ({});
  const onRequest = { ...CATHODE, uid: 'thiec-thoi', name: 'Thiếc thỏi', price: null, price_on_request: true };
  const perTon = { ...CATHODE, uid: 'nhom-a7', name: 'Nhôm A7', price: 68500000, price_unit: 'đ/tấn' };
  await prerenderDirectory(target, {
    sourceDir: root,
    loadSettings: empty,
    loadCategories: async () => [],
    loadNavigation: empty,
    loadPageContent: empty,
    loadProducts: async () => [CATHODE, onRequest, perTon, { ...CATHODE, uid: '../thoat' }],
    loadAnalyses: async () => [],
    loadFormConfig: empty,
    loadArticles: async () => [],
    log: { warn() {} },
  });

  const read = (uid) => new JSDOM(fs.readFileSync(path.join(target, 'san-pham', uid, 'index.html'), 'utf8')).window.document;
  const doc = read('dong-tam-cathode');
  assert.equal(doc.title, 'Đồng Tấm Cathode - DHA Minerals');
  assert.equal(doc.querySelector('meta[property="og:image"]').content, CATHODE.image);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, 'https://dhakimloaimau.vn/san-pham/dong-tam-cathode');
  const ld = JSON.parse(doc.getElementById('product-jsonld').textContent);
  assert.equal(ld['@type'], 'Product');
  assert.equal(ld.offers.price, '285000');
  assert.equal(ld.offers.priceCurrency, 'VND');
  assert.equal(ld.offers.priceSpecification.unitText, 'kg');
  assert.equal(JSON.parse(read('nhom-a7').getElementById('product-jsonld').textContent).offers.priceSpecification.unitText, 'tấn');
  assert.equal(JSON.parse(read('thiec-thoi').getElementById('product-jsonld').textContent).offers, undefined, 'giá liên hệ thì không khai báo giá');
  assert.ok(!fs.existsSync(path.join(target, 'san-pham', 'da-xoa')), 'sản phẩm đã xoá bị dọn');
  assert.ok(!fs.existsSync(path.join(target, 'thoat')), 'mã có ".." không thoát ra ngoài');
  assert.match(fs.readFileSync(path.join(target, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/dhakimloaimau\.vn\/san-pham\/dong-tam-cathode<\/loc>/);
});

test('đọc sản phẩm lỗi thì giữ trang tĩnh và sitemap cũ', async () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'dha-products-'));
  fs.mkdirSync(path.join(target, 'san-pham', 'cu'), { recursive: true });
  fs.writeFileSync(path.join(target, 'san-pham', 'cu', 'index.html'), 'cũ');
  fs.writeFileSync(path.join(target, 'sitemap.xml'), 'sitemap cũ');
  const empty = async () => ({});
  await prerenderDirectory(target, {
    sourceDir: root,
    loadSettings: empty,
    loadCategories: async () => [],
    loadNavigation: empty,
    loadPageContent: empty,
    loadProducts: async () => { throw new Error('CMS sập'); },
    loadAnalyses: async () => [],
    loadFormConfig: empty,
    loadArticles: async () => [],
    log: { warn() {} },
  });
  assert.ok(fs.existsSync(path.join(target, 'san-pham', 'cu', 'index.html')));
  assert.equal(fs.readFileSync(path.join(target, 'sitemap.xml'), 'utf8'), 'sitemap cũ');
});

test('sitemap: sản phẩm đứng sau trang tĩnh, trước bài viết', () => {
  const xml = buildSitemapXml([{ slug: 'bai-a' }], [{ uid: 'sp-a' }]);
  assert.ok(xml.indexOf('/san-pham/sp-a') < xml.indexOf('/tin-tuc/bai-a'));
  assert.ok(xml.indexOf('/contact') < xml.indexOf('/san-pham/sp-a'));
});

test('nginx: /san-pham/ dùng trang tĩnh, /product-detail?id= chuyển 301; deploy không xoá trang tĩnh', () => {
  const nginx = fs.readFileSync(path.join(root, 'deploy/nginx.conf'), 'utf8');
  assert.match(nginx, /location \/san-pham\/ \{\s*try_files \$uri \$uri\/index\.html \/product-detail\.html;/);
  assert.match(nginx, /location = \/product-detail \{[\s\S]*?return 301 \/san-pham\/\$arg_id;[\s\S]*?try_files \/product-detail\.html =404;/);
  assert.match(fs.readFileSync(path.join(root, 'deploy/apply-nginx.sh'), 'utf8'), /location \/san-pham\//);
  assert.match(fs.readFileSync(path.join(root, 'deploy/deploy.sh'), 'utf8'), /--exclude="san-pham\/"/);
});

test('chấm SEO sản phẩm theo tiêu chí riêng của trang sản phẩm', async () => {
  const { analyzeSeo } = await import(`file://${path.join(root, 'admin/src/lib/seo.js')}`);
  const good = analyzeSeo({
    ...CATHODE,
    focus_keyword: 'đồng tấm cathode',
    seo_title: 'Đồng tấm cathode 99,95% Cu nhập khẩu - DHA',
    seo_description: 'Đồng tấm cathode hàm lượng trên 99,95% Cu, nhập khẩu, đóng kiện 125 kg. Nguyên liệu kéo dây, đúc phôi, sản xuất hợp kim. Liên hệ DHA nhận báo giá.',
  }, { kind: 'product' });
  assert.equal(good.score, 100, JSON.stringify(good.checks.filter((check) => check.status !== 'good')));
  const oldUid = analyzeSeo({ ...CATHODE, uid: 'sp-01', focus_keyword: 'đồng tấm cathode' }, { kind: 'product' });
  assert.equal(oldUid.checks.find((check) => check.id === 'keyword-slug').status, 'warn', 'mã cũ không chứa từ khoá chỉ là cảnh báo nhẹ');
  assert.ok(!good.checks.some((check) => check.id === 'headings'), 'không đòi tiêu đề mục như bài viết');

  const bare = analyzeSeo({ name: 'X', description: 'ngắn' }, { kind: 'product' });
  const byId = Object.fromEntries(bare.checks.map((check) => [check.id, check.status]));
  assert.equal(byId.image, 'bad');
  assert.equal(byId['body-length'], 'warn');
  assert.equal(bare.title, 'X - DHA Minerals');
});
