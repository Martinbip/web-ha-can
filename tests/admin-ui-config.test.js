const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const {
  getResourceConfig,
} = require('../dha-cms/src/api/admin-ui/services/resource-config');

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
