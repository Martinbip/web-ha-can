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
