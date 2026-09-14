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

test('prerender chạy đúng hai lượt: ngay sau đồng bộ và sau khi Strapi lên', () => {
  const sitemap = source.indexOf('generate-sitemap.js');
  const restart = source.indexOf('pm2 restart dha-cms');
  const prerenderCalls = [...source.matchAll(/scripts\/prerender-site-settings\.js/g)].map((m) => m.index);

  assert.ok(sitemap > 0, 'có bước sinh sitemap');
  assert.ok(restart > 0, 'có bước khởi động lại Strapi');
  assert.equal(prerenderCalls.length, 2, 'phải gọi prerender đúng hai lần');
  assert.ok(prerenderCalls[0] > sitemap, 'lượt 1 phải đứng sau bước sinh sitemap');
  assert.ok(prerenderCalls[0] < restart, 'lượt 1 phải đứng trước pm2 restart dha-cms');
  assert.ok(prerenderCalls[1] > restart, 'lượt 2 phải đứng sau pm2 restart dha-cms');
});

test('lượt 2 đợi Strapi trả lời (health check) trước khi đọc', () => {
  const restart = source.indexOf('pm2 restart dha-cms');
  const secondPrerender = source.lastIndexOf('scripts/prerender-site-settings.js');
  const between = source.slice(restart, secondPrerender);
  assert.match(between, /for _ in \$\(seq 1 30\)/);
  assert.match(between, /curl -sf -o \/dev\/null --max-time 5 http:\/\/127\.0\.0\.1:1337\/_health/);
  assert.match(between, /sleep 2/);
  assert.match(source, /Strapi chưa trả lời sau 60 giây/);
});
