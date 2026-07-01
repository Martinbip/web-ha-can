const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('admin app is a Vite React app served from /admin', () => {
  const packageJson = JSON.parse(read('admin/package.json'));
  const app = read('admin/src/App.jsx');
  const client = read('admin/src/api/client.js');

  assert.ok(packageJson.dependencies.react, 'React dependency exists');
  assert.ok(packageJson.devDependencies.vite, 'Vite dev dependency exists');
  assert.equal(packageJson.scripts.build, 'vite build');
  assert.match(app, /BrowserRouter/, 'app uses browser routing');
  assert.match(client, /credentials:\s*['"]include['"]/, 'fetch includes HTTP-only auth cookie');
  assert.match(client, /\/api\/admin-ui/, 'client calls only admin-ui API');
});

test('admin shell uses WordPress-style navigation labels', () => {
  const shell = read('admin/src/layout/AdminShell.jsx');

  for (const label of ['Dashboard', 'Tin tức', 'Sản phẩm', 'Dự án', 'Dịch vụ', 'Trang chủ', 'Bảng giá', 'Liên hệ', 'Đơn đặt mẫu', 'Thư viện ảnh', 'Cài đặt website']) {
    assert.match(shell, new RegExp(label), `${label} navigation label exists`);
  }
});

test('admin resource config covers all full admin modules and field types', () => {
  const config = read('admin/src/config/resources.js');
  const listPage = read('admin/src/pages/ResourceListPage.jsx');
  const editPage = read('admin/src/pages/ResourceEditPage.jsx');
  const fieldRenderer = read('admin/src/components/FieldRenderer.jsx');

  for (const alias of ['news', 'products', 'projects', 'services', 'hero-slides', 'workflow-steps', 'pricing-packages', 'pricing-analyses', 'pricing-surveys', 'contact-inquiries', 'order-requests']) {
    assert.match(config, new RegExp(`['"]${alias}['"]`), `${alias} frontend config exists`);
  }

  for (const fieldType of ['richtext', 'cloudinary-image', 'key-value-table', 'text-list']) {
    assert.match(fieldRenderer, new RegExp(fieldType), `${fieldType} input is handled`);
  }

  assert.match(listPage, /publishResource/, 'list supports publish actions');
  assert.match(editPage, /saveResource/, 'edit page saves resources');
});
