const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const {
  getResourceConfig,
} = require('../dha-cms/src/api/admin-ui/services/resource-config');
const { getScopedPrefix } = require('../dha-cms/src/api/admin-ui/services/media');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('admin-ui resource config whitelists every planned module', () => {
  const configSource = read('dha-cms/src/api/admin-ui/services/resource-config.js');
  const expectedAliases = [
    'news',
    'products',
    'projects',
    'services',
    'hero-slides',
    'workflow-steps',
    'pricing-packages',
    'pricing-analyses',
    'pricing-surveys',
    'site-setting',
    'contact-inquiries',
    'order-requests',
  ];

  for (const alias of expectedAliases) {
    assert.match(configSource, new RegExp(`['"]${alias}['"]`), `${alias} is configured`);
  }

  assert.doesNotMatch(configSource, /ctx\.params\.type/, 'resource config must not trust raw route params as Strapi UIDs');
});

test('admin-ui config includes Vietnamese labels and safe editable fields', () => {
  const configSource = read('dha-cms/src/api/admin-ui/services/resource-config.js');

  for (const label of ['Tin tức', 'Sản phẩm', 'Dự án', 'Dịch vụ', 'Cài đặt website']) {
    assert.match(configSource, new RegExp(label), `${label} label is present`);
  }

  for (const forbidden of ['createdBy', 'updatedBy', 'localizations']) {
    assert.doesNotMatch(configSource, new RegExp(`['"]${forbidden}['"]`), `${forbidden} is not editable`);
  }
});

test('getResourceConfig only returns own whitelisted aliases', () => {
  assert.equal(getResourceConfig('__proto__'), null);
  assert.equal(getResourceConfig('constructor'), null);
  assert.equal(getResourceConfig('toString'), null);
  assert.equal(getResourceConfig('unknown-resource'), null);
  assert.equal(getResourceConfig('projects')?.uid, 'api::project.project');
});

test('project and hero editor labels match Task 1 schema and locale', () => {
  const projects = getResourceConfig('projects');
  const heroSlides = getResourceConfig('hero-slides');
  const siteSetting = getResourceConfig('site-setting');

  assert.deepEqual(projects.editableFields, ['name', 'location', 'scale', 'method', 'value', 'image']);
  assert.equal(projects.fields.image.label, 'Ảnh dự án');
  assert.equal(projects.fields.cloudinary_image_url, undefined);
  assert.equal(projects.fields.cloudinary_public_id, undefined);

  assert.equal(heroSlides.label, 'Slide trang chủ');
  assert.equal(heroSlides.pluralLabel, 'Slide trang chủ');
  assert.equal(siteSetting.fields.hero_tagline.label, 'Dòng giới thiệu trang chủ');
  assert.equal(siteSetting.fields.hero_title.label, 'Tiêu đề trang chủ');
  assert.equal(siteSetting.fields.hero_description.label, 'Mô tả trang chủ');
});

test('admin-ui auth uses http-only cookie and never exposes Cloudinary secrets', () => {
  const authSource = read('dha-cms/src/api/admin-ui/services/auth.js');
  const routesSource = read('dha-cms/src/api/admin-ui/routes/admin-ui.js');

  assert.match(authSource, /httpOnly:\s*true/, 'session cookie is http-only');
  assert.match(authSource, /sameSite:\s*['"]lax['"]/, 'session cookie is sameSite lax');
  assert.match(authSource, /ADMIN_UI_SESSION_SECRET/, 'custom session secret is required');
  assert.match(routesSource, /auth:\s*false/, 'admin-ui routes bypass Strapi Content API auth');
  assert.doesNotMatch(authSource, /CLOUDINARY_API_SECRET|CLOUDINARY_URL/, 'auth service must not read Cloudinary secrets');
});

test('admin-ui login route is tightly rate limited', () => {
  const routesSource = read('dha-cms/src/api/admin-ui/routes/admin-ui.js');

  assert.match(routesSource, /path:\s*['"]\/admin-ui\/auth\/login['"][\s\S]*name:\s*['"]global::rate-limit['"]/, 'login route uses global rate-limit middleware');
  assert.match(routesSource, /windowMs:\s*15\s*\*\s*60\s*\*\s*1000/, 'login rate limit uses a 15 minute window');
  assert.match(routesSource, /max:\s*5/, 'login rate limit allows at most 5 attempts');
});

test('admin-ui auth compares signatures without timingSafeEqual length throws', () => {
  const authSource = read('dha-cms/src/api/admin-ui/services/auth.js');

  assert.match(authSource, /safe[A-Za-z]*Equal|signature\.length\s*!==\s*expected\.length|expected\.length\s*!==\s*signature\.length/, 'auth service guards timingSafeEqual length mismatch or uses a safe comparison helper');
});

test('admin-ui CORS does not allowlist null origin for credentials', () => {
  const middlewaresSource = read('dha-cms/config/middlewares.js');

  assert.doesNotMatch(middlewaresSource, /['"]null['"]/, 'credentialed CORS must not allowlist Origin: null');
});

test('admin-ui resources use whitelisted config and Strapi 5 document service', () => {
  const source = read('dha-cms/src/api/admin-ui/services/resources.js');

  assert.match(source, /getResourceConfig/, 'resource service loads whitelist config');
  assert.match(source, /strapi\.documents\(config\.uid\)/, 'resource service uses Strapi 5 document service');
  assert.doesNotMatch(source, /strapi\.documents\(ctx\.params\.type\)/, 'route param is never used as a document UID');
  assert.match(source, /editableFields/, 'writes are limited to editable fields');
  assert.match(source, /publishedAt/, 'publish state is represented in responses');
});

test('admin-ui resource responses use explicit read whitelists', () => {
  const source = read('dha-cms/src/api/admin-ui/services/resources.js');
  const configSource = read('dha-cms/src/api/admin-ui/services/resource-config.js');

  assert.doesNotMatch(source, /publicationState/, 'Strapi 5 document service must not use v4 publicationState');
  assert.match(source, /function getReadableFields/, 'resource service defines readable field whitelist');
  assert.match(source, /function normalizeEntry/, 'resource service normalizes outbound entries');
  assert.doesNotMatch(source, /function normalizeEntry\(entry\)\s*{\s*return entry;\s*}/, 'normalizeEntry must not return raw documents');
  assert.match(source, /fields:\s*getDocumentFields\(config\)/, 'document reads request whitelisted fields');
  assert.match(configSource, /readFields:\s*\[[^\]]*email[^\]]*address[^\]]*message[^\]]*\]/, 'contact details are explicitly whitelisted');
  assert.match(configSource, /readFields:\s*\[[^\]]*product_uid[^\]]*email[^\]]*unit[^\]]*note[^\]]*\]/, 'order details are explicitly whitelisted');
});

test('admin-ui mutations require trusted origins and safe pagination defaults', () => {
  const authSource = read('dha-cms/src/api/admin-ui/services/auth.js');
  const resourceSource = read('dha-cms/src/api/admin-ui/services/resources.js');

  assert.match(authSource, /function requireTrustedOrigin/, 'auth service exposes trusted origin guard');
  assert.match(authSource, /ctx\.request\.headers\.origin/, 'origin header is checked');
  assert.match(authSource, /ctx\.request\.headers\.referer/, 'referer header is checked as fallback');
  assert.match(authSource, /CSRF_ORIGIN/, 'unsafe mutation origin returns a CSRF-style error');

  for (const fn of ['create', 'update', 'remove', 'publish', 'unpublish']) {
    assert.match(resourceSource, new RegExp(`async function ${fn}[\\s\\S]*auth\\.requireTrustedOrigin\\(ctx\\)`), `${fn} checks trusted origin before mutating`);
  }

  assert.match(resourceSource, /Number\.isFinite/, 'pagination rejects NaN query values');
  assert.doesNotMatch(resourceSource, /Math\.max\(Number\(ctx\.query\.page/, 'pagination must not pass NaN through Math.max');
});

test('admin-ui media service stores images in Cloudinary and checks references before delete', () => {
  const source = read('dha-cms/src/api/admin-ui/services/media.js');
  const packageJson = JSON.parse(read('dha-cms/package.json'));

  assert.ok(packageJson.dependencies.cloudinary, 'Cloudinary SDK is installed');
  assert.match(source, /require\(['"]cloudinary['"]\)\.v2/, 'Cloudinary v2 SDK is used');
  assert.match(source, /CLOUDINARY_URL|CLOUDINARY_CLOUD_NAME/, 'Cloudinary env config is read server-side');
  assert.match(source, /api\.resources/, 'media list uses Cloudinary resources API');
  assert.match(source, /uploader\.upload/, 'upload uses Cloudinary uploader');
  assert.match(source, /delete_resources/, 'delete uses Cloudinary delete resources');
  assert.match(source, /findReferences/, 'delete checks known content references first');
  assert.doesNotMatch(source, /ctx\.request\.body\.api_secret/, 'frontend cannot send Cloudinary secrets');
});

test('admin-ui media service scopes library access and validates uploads', () => {
  const source = read('dha-cms/src/api/admin-ui/services/media.js');

  assert.doesNotMatch(source, /publicationState/, 'media reference checks must not use Strapi v4 publicationState');
  assert.match(source, /function getScopedPrefix/, 'media listing normalizes requested prefix');
  assert.match(source, /prefix\.startsWith\(['"]ha-can\/['"]\)/, 'media listing is scoped to ha-can library');
  assert.match(source, /function validateUploadFile/, 'upload validates files before Cloudinary');
  assert.match(source, /MAX_UPLOAD_BYTES/, 'upload enforces a size limit');
  assert.match(source, /image\/jpeg/, 'upload allows jpeg images explicitly');
  assert.match(source, /image\/png/, 'upload allows png images explicitly');
  assert.match(source, /image\/webp/, 'upload allows webp images explicitly');
  assert.match(source, /INVALID_FILE_TYPE/, 'invalid upload type returns a clear error');
});

test('getScopedPrefix resolves path segments and rejects traversal at runtime', () => {
  assert.equal(getScopedPrefix(undefined), 'ha-can/', 'no value falls back to default prefix');
  assert.equal(getScopedPrefix(undefined, 'ha-can/uploads'), 'ha-can/uploads', 'no value falls back to custom fallback');
  assert.equal(getScopedPrefix('ha-can/products'), 'ha-can/products', 'valid subfolder is preserved unchanged');
  assert.equal(getScopedPrefix('something-else/'), 'ha-can/', 'value outside ha-can namespace falls back');

  const traversalResult = getScopedPrefix('ha-can/../../other-tenant-prefix');
  assert.ok(traversalResult.startsWith('ha-can/'), 'traversal input still resolves inside ha-can/ namespace');
  assert.ok(!traversalResult.includes('..'), 'traversal segments are stripped from the resolved prefix');
  assert.equal(traversalResult, 'ha-can/other-tenant-prefix', 'traversal segments collapse to a safe in-namespace prefix');
});
