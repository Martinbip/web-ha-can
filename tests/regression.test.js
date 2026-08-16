const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function schema(file) {
  return JSON.parse(read(file));
}

test('contact form submits all required CMS fields and does not hide failed submissions', () => {
  const contactHtml = read('contact.html');
  const appJs = read('app.js');
  const contactSchema = schema('dha-cms/src/api/contact-inquiry/content-types/contact-inquiry/schema.json');
  const requiredFields = Object.entries(contactSchema.attributes)
    .filter(([, definition]) => definition.required)
    .map(([name]) => name);

  for (const field of requiredFields) {
    assert.match(contactHtml, new RegExp(`id="contact-${field}"`), `${field} input is rendered`);
    assert.match(appJs, new RegExp(`\\b${field}\\b`), `${field} is handled in app.js`);
  }

  assert.doesNotMatch(appJs, /dha_pending_contacts/, 'failed CMS submissions should not be silently stored only in localStorage');
});

test('product detail page can submit order requests to the CMS', () => {
  const appJs = read('app.js');
  const orderSchema = schema('dha-cms/src/api/order-request/content-types/order-request/schema.json');
  const requiredFields = Object.entries(orderSchema.attributes)
    .filter(([, definition]) => definition.required)
    .map(([name]) => name);

  assert.match(appJs, /order-requests/, 'frontend posts order requests to Strapi');
  assert.match(appJs, /function initProductOrderForm/, 'product detail initializes an order request form');

  for (const field of requiredFields) {
    assert.match(appJs, new RegExp(`\\b${field}\\b`), `${field} is included in the order payload`);
  }
});

test('homepage CMS-managed content is seeded and publicly readable', () => {
  const bootstrap = read('dha-cms/src/index.js');
  const expectedSeeds = [
    ['api::hero-slide.hero-slide', 'hero_slides.json'],
    ['api::service.service', 'services.json'],
    ['api::workflow-step.workflow-step', 'workflow_steps.json'],
    ['api::ore.ore', 'products.json'],
  ];

  for (const [uid, filename] of expectedSeeds) {
    assert.match(bootstrap, new RegExp(uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${uid} is seeded`);
    assert.match(bootstrap, new RegExp(filename.replace('.', '\\.')), `${filename} is used for seeding`);
  }

  for (const uid of ['api::hero-slide.hero-slide', 'api::service.service', 'api::workflow-step.workflow-step']) {
    assert.match(bootstrap, new RegExp(`${uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.find`), `${uid}.find permission is public`);
    assert.match(bootstrap, new RegExp(`${uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.findOne`), `${uid}.findOne permission is public`);
  }
});

test('estimator reads ore prices from the CMS price field', () => {
  const appJs = read('app.js');

  assert.match(appJs, /getOrePrice/, 'estimator has an explicit ore price normalizer');
  assert.doesNotMatch(appJs, /o\.base_price\s*\|\|\s*0/, 'estimator must not ignore the CMS price field');
});

test('CORS checks exact allowed origins', () => {
  const middlewares = read('dha-cms/config/middlewares.js');

  assert.match(middlewares, /new URL/, 'CORS should parse origins as URLs');
  assert.doesNotMatch(middlewares, /origin\.startsWith/, 'CORS must not allow prefix origin matches');
});

test('dynamic service links are validated before navigation', () => {
  const appJs = read('app.js');

  assert.match(appJs, /function safeInternalUrl/, 'dynamic URLs have a whitelist helper');
  assert.doesNotMatch(appJs, /onclick="location\.href=/, 'service cards should not use inline onclick navigation');
});

test('deployment scripts avoid accidental commits and destructive port kills', () => {
  const deploy = read('deploy/deploy.sh');
  const start = read('start.sh');
  const backup = read('deploy/backup-strapi.sh');
  const rootPackage = schema('package.json');

  assert.doesNotMatch(deploy, /git add -A/, 'deploy should not stage every local file');
  assert.match(deploy, /git diff --quiet/, 'deploy should require a clean working tree');
  assert.doesNotMatch(start, /kill -9/, 'dev startup should not force kill unrelated processes');
  assert.match(backup, /dha-cms\/\.tmp\/data\.db/, 'backup script includes Strapi sqlite database');
  assert.match(backup, /public\/uploads/, 'backup script includes Strapi uploads');
  assert.equal(rootPackage.scripts.test, 'node --test tests/regression.test.js tests/admin-ui-config.test.js tests/admin-app.test.js');
});

test('keyboard focus remains visible on interactive inputs', () => {
  const styles = read('styles.css');

  assert.match(styles, /:focus-visible/, 'styles should define focus-visible states');
  assert.doesNotMatch(styles, /outline:\s*none;/, 'styles should not remove outlines without replacement');
});

test('project rendering prefers Cloudinary image URLs during media migration', () => {
  const projectSchema = schema('dha-cms/src/api/project/content-types/project/schema.json');
  const appJs = read('app.js');

  assert.ok(projectSchema.attributes.cloudinary_image_url, 'project schema includes Cloudinary image URL');
  assert.ok(projectSchema.attributes.cloudinary_public_id, 'project schema stores Cloudinary public ID');
  assert.match(appJs, /cloudinary_image_url/, 'frontend checks project Cloudinary image URL');
  assert.match(appJs, /getProjectImageUrl/, 'frontend uses one normalizer for project images');
});

test('custom admin deployment and Cloudinary setup are documented', () => {
  const readme = read('README_CMS.md');
  const rootPackage = schema('package.json');
  const nginx = read('deploy/nginx.conf');

  assert.match(readme, /\/admin/, 'README documents custom admin URL');
  assert.match(readme, /CLOUDINARY_URL|CLOUDINARY_CLOUD_NAME/, 'README documents Cloudinary environment variables');
  assert.match(readme, /ADMIN_UI_SESSION_SECRET/, 'README documents custom admin session secret');
  assert.ok(rootPackage.scripts['admin:build'], 'root package has admin build script');
  assert.match(nginx, /\/admin/, 'nginx config mentions admin route handling');
});

// The hero carousel used to ship three hardcoded slides in the markup, which
// the CMS render then replaced. Whenever the CMS was slow or unreachable the
// homepage showed those stale images instead of what the admin had set, so the
// slides now come from the CMS only.
test('hero slides come from the CMS, not from hardcoded markup', () => {
  const html = read('index.html');
  const appJs = read('app.js');

  const carousel = html.split('id="hero-carousel"')[1].split('</section>')[0];
  assert.doesNotMatch(carousel, /class="carousel-slide/, 'no hardcoded hero slide markup');
  assert.doesNotMatch(carousel, /assets\/[a-z_]+\.png/, 'no hardcoded hero image files');

  assert.match(appJs, /initHeroSlides/, 'hero slides are rendered from the CMS');
  assert.doesNotMatch(
    appJs.split('async function initHeroSlides')[1].split('\n}')[0],
    /hero_slides\.json/,
    'hero slides do not fall back to a stale local copy',
  );
});

// Strapi 5's Document Service writes to the draft version only. Content types
// with draftAndPublish (hero slides, news, products…) therefore kept serving
// the old published version to the website after an editor pressed Lưu — the
// admin showed the new image, the site showed the old one.
test('saving in the custom admin republishes so the website matches', () => {
  const resources = read('dha-cms/src/api/admin-ui/services/resources.js');

  assert.match(resources, /async function publishAfterWrite/, 'writes go through a republish helper');
  const helper = resources.split('async function publishAfterWrite')[1].split('\n}')[0];
  assert.match(helper, /draftAndPublish/, 'helper only republishes draft-and-publish types');
  assert.match(helper, /\.publish\(/, 'helper publishes the document');

  for (const fn of ['async function create', 'async function update']) {
    const body = resources.split(fn)[1].split('\n}\n')[0];
    assert.match(body, /publishAfterWrite/, `${fn.replace('async function ', '')} republishes after writing`);
  }
});

// Cùng loại lỗi với hero slides: các khối do CMS quản lý được nhúng sẵn nội
// dung mẫu trong HTML rồi mới bị JS ghi đè, nên trang hiện dữ liệu cũ mỗi lần
// tải và đứng luôn ở đó nếu CMS lỗi.
test('CMS-managed lists ship empty markup instead of sample content', () => {
  const home = read('index.html');
  const pricing = read('pricing.html');

  const block = (html, anchor, closing) => {
    const i = html.indexOf(anchor);
    assert.ok(i >= 0, `${anchor} exists`);
    return html.slice(i, html.indexOf(closing, i));
  };

  assert.doesNotMatch(block(home, 'services-grid', '</section>'), /service-card/, 'no sample service cards');
  assert.doesNotMatch(block(home, 'workflow-timeline', '</section>'), /timeline-item/, 'no sample workflow steps');

  // Bảng giá chỉ được chứa dòng "Đang tải", không phải giá mẫu.
  for (const [html, id] of [[home, 'market-price-body'], [pricing, 'pricing-table-body']]) {
    const rows = block(html, id, '</tbody>').match(/<tr/g) || [];
    assert.equal(rows.length, 1, `${id} holds only a loading row`);
    assert.match(block(html, id, '</tbody>'), /Đang tải/, `${id} loading row is a placeholder`);
  }
});

// Giá kim loại đổi hằng ngày; phục vụ một bản sao tĩnh cũ còn tệ hơn không
// hiện bảng giá nào.
test('market prices are never served from a stale local copy', () => {
  const appJs = read('app.js');
  const body = appJs.split('async function initMarketPrices')[1].split('\n}\n')[0];

  assert.doesNotMatch(body, /pricing_packages\.json/, 'market prices have no static fallback');
});

// Số hotline, email, mã số thuế nhúng cứng vẫn cần cho SEO và cho người tắt
// JS, nhưng phải khớp dữ liệu thật, nếu không chúng phát tán thông tin sai.
test('hardcoded contact details match the seeded site settings', () => {
  const settings = schema('data/site_setting.json');
  const digits = (value) => String(value).replace(/[^0-9]/g, '');

  for (const file of ['index.html', 'contact.html', 'news.html', 'pricing.html', 'products.html', 'projects.html', 'estimator.html']) {
    const html = read(file);
    const phones = [...html.matchAll(/href="tel:([0-9.\s]+)"/g)].map((m) => digits(m[1]));
    for (const phone of phones) {
      assert.equal(phone, digits(settings.hotline), `${file} hotline matches site settings`);
    }
    const emails = [...html.matchAll(/href="mailto:([^"]+)"/g)].map((m) => m[1]);
    for (const email of emails) {
      assert.equal(email, settings.email, `${file} email matches site settings`);
    }
    if (html.includes('MST:')) {
      assert.match(html, new RegExp(`MST: ${settings.tax_code}`), `${file} tax code matches site settings`);
    }
  }
});

// Markup để sẵn link mạng xã hội mẫu và chỉ ghi đè khi CMS có dữ liệu, nên khi
// quản trị bỏ trống thì trang dẫn khách tới tài khoản không tồn tại.
test('social links are hidden when the CMS has no address for them', () => {
  const appJs = read('app.js');
  const body = appJs.split('async function initSiteSettings')[1].split('\n}\n')[0];

  assert.match(body, /SOCIAL_LINKS/, 'social links go through one list');
  assert.match(body, /hidden = true/, 'links without an address are hidden');
  assert.match(body, /zalo\.me\/\$\{hotlineClean\}/, 'Zalo falls back to the hotline number');
});

// Bỏ markup mẫu khỏi HTML làm lộ ra việc CMS chưa có bản ghi dịch vụ và bước
// quy trình nào: hai khối trên trang chủ trống trơn. Bản mẫu trong data/ đóng
// vai trò nội dung khởi tạo cho tới khi quản trị nhập bản ghi đầu tiên.
test('services and workflow fall back to seed content only while the CMS is empty', () => {
  const appJs = read('app.js');
  const helper = appJs.split('async function fetchWithSeedContent')[1].split('\n}\n')[0];

  assert.match(helper, /items\.length > 0/, 'CMS content wins whenever it exists');
  assert.match(appJs, /fetchWithSeedContent\('services/, 'services use seed content');
  assert.match(appJs, /fetchWithSeedContent\('workflow-steps/, 'workflow steps use seed content');
});
