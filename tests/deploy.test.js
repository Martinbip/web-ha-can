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

test('cả hai lượt prerender đều ghi từ bản mẫu trong repo sang thư mục phục vụ', () => {
  const calls = source.match(/node \/var\/www\/web-ha-can\/scripts\/prerender-site-settings\.js[^\n]*/g) || [];
  assert.equal(calls.length, 2, 'đúng hai lượt prerender');
  for (const call of calls) {
    assert.match(call, /\/var\/www\/dhakimloaimau\.vn \/var\/www\/web-ha-can/, 'truyền đích rồi nguồn');
  }
});

// HTML tĩnh chỉ được ghi lại khi quản trị bấm Lưu hoặc khi deploy. Những thứ
// đổi theo thời gian (năm trong dòng bản quyền) cần một lượt ghi định kỳ.
const CRON_FILE = path.join(root, 'deploy/dha-prerender.cron');

test('có lịch ghi lại HTML tĩnh mỗi giờ, đọc bản mẫu ghi sang thư mục phục vụ', () => {
  const cron = fs.readFileSync(CRON_FILE, 'utf8');
  assert.ok(cron.endsWith('\n'), 'file trong /etc/cron.d phải kết thúc bằng xuống dòng, không thì cron bỏ qua dòng cuối');
  const jobs = cron.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#') && !/^[A-Z_]+=/.test(line));
  assert.equal(jobs.length, 1, 'đúng một lịch');
  const [minute, hour, dom, month, dow, user, ...command] = jobs[0].trim().split(/\s+/);
  assert.match(minute, /^\d+$/, 'chạy vào một phút cố định');
  assert.deepEqual([hour, dom, month, dow], ['*', '*', '*', '*'], 'mỗi giờ');
  assert.equal(user, 'root', 'file trong /etc/cron.d cần cột người dùng');
  assert.equal(command[0], '__NODE__', 'đường dẫn node do deploy.sh điền — cron không có PATH đầy đủ');
  assert.match(command.join(' '), /\/var\/www\/web-ha-can\/scripts\/prerender-site-settings\.js \/var\/www\/dhakimloaimau\.vn \/var\/www\/web-ha-can/);
});

test('deploy.sh cài lịch vào /etc/cron.d với đường dẫn node tuyệt đối', () => {
  const start = source.indexOf('# Lịch ghi lại HTML tĩnh mỗi giờ');
  assert.ok(start > 0, 'deploy.sh có bước cài lịch');
  const install = source.slice(start, source.indexOf('\nfi\n', start));
  assert.match(install, /NODE_BIN="?\$\(command -v node[^)]*\)"?/);
  assert.match(install, /sed "s#__NODE__#\$NODE_BIN#" \/var\/www\/web-ha-can\/deploy\/dha-prerender\.cron > \/etc\/cron\.d\/dha-prerender/);
  // Tên file đích không có dấu chấm: cron trên Debian/Ubuntu bỏ qua file như vậy.
  assert.match(install, /chmod 644 \/etc\/cron\.d\/dha-prerender/);
});
