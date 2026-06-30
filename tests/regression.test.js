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
  assert.equal(rootPackage.scripts.test, 'node --test tests/regression.test.js tests/admin-ui-config.test.js');
});

test('keyboard focus remains visible on interactive inputs', () => {
  const styles = read('styles.css');

  assert.match(styles, /:focus-visible/, 'styles should define focus-visible states');
  assert.doesNotMatch(styles, /outline:\s*none;/, 'styles should not remove outlines without replacement');
});
