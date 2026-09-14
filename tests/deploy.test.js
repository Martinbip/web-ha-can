// deploy.sh chạy trên VPS nên không thử thật được ở đây; test giữ đúng thứ tự
// các bước và cú pháp bash.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const SCRIPT = path.join(root, 'deploy/deploy.sh');
const source = fs.readFileSync(SCRIPT, 'utf8');

test('deploy.sh đúng cú pháp bash', () => {
  execFileSync('bash', ['-n', SCRIPT]);
});

test('prerender chạy sau khi Strapi được build và khởi động lại', () => {
  const restart = source.indexOf('pm2 restart dha-cms');
  const prerender = source.indexOf('scripts/prerender-site-settings.js');
  assert.ok(restart > 0, 'có bước khởi động lại Strapi');
  assert.ok(prerender > restart, 'prerender phải đứng sau bước khởi động lại Strapi');
  assert.equal(source.match(/scripts\/prerender-site-settings\.js/g).length, 1, 'chỉ chạy prerender một lần');
});

test('prerender đợi Strapi trả lời trước khi đọc', () => {
  const between = source.slice(source.indexOf('pm2 restart dha-cms'), source.indexOf('scripts/prerender-site-settings.js'));
  assert.match(between, /for _ in \$\(seq 1 30\)/);
  assert.match(between, /curl -sf -o \/dev\/null http:\/\/127\.0\.0\.1:1337\/api\/site-setting/);
  assert.match(between, /sleep 2/);
  assert.match(source, /Strapi chưa trả lời sau 60 giây/);
});
