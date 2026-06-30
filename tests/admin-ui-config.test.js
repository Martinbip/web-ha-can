const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

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
