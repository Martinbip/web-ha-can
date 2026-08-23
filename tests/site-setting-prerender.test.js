// Prerender chạy lúc deploy, nên đổi hotline trong trang quản trị mà chưa deploy
// thì HTML tĩnh vẫn là số cũ. Hook này chạy lại prerender ngay sau khi lưu.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { EventEmitter } = require('node:events');

const root = path.resolve(__dirname, '..');
const { createPrerenderRunner } = require('../dha-cms/src/api/site-setting/prerender.js');

// Bộ đồ giả: tiến trình con không chạy thật, đồng hồ do test bấm.
function harness({ exists = () => true } = {}) {
  const calls = [];
  const children = [];
  const timers = [];

  const runner = createPrerenderRunner({
    script: '/var/www/web-ha-can/scripts/prerender-site-settings.js',
    htmlDir: '/var/www/dhakimloaimau.vn',
    delayMs: 1000,
    exists,
    log: () => {},
    setTimeout: (fn, ms) => {
      timers.push({ fn, ms });
      return { unref() {} };
    },
    spawn: (command, args) => {
      calls.push({ command, args });
      const child = Object.assign(new EventEmitter(), { unref() {} });
      children.push(child);
      return child;
    },
  });

  return {
    runner,
    calls,
    children,
    timers,
    tick: () => timers.splice(0).forEach((timer) => timer.fn()),
    finish: (code = 0) => children.splice(0).forEach((child) => child.emit('close', code)),
  };
}

test('lưu cài đặt thì chạy prerender vào đúng thư mục website', () => {
  const h = harness();

  h.runner();
  assert.deepEqual(h.calls, [], 'chưa chạy ngay — chờ dữ liệu ghi xong đã');

  h.tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].command, 'node');
  assert.deepEqual(h.calls[0].args, [
    '/var/www/web-ha-can/scripts/prerender-site-settings.js',
    '/var/www/dhakimloaimau.vn',
  ]);
});

test('lưu liên tiếp nhiều lần chỉ chạy một lượt', () => {
  const h = harness();

  h.runner();
  h.runner();
  h.runner();
  h.tick();

  assert.equal(h.calls.length, 1, 'ba lần lưu gộp thành một lượt chạy');
});

test('lưu lúc đang chạy thì chạy lại một lượt nữa sau khi xong', () => {
  const h = harness();

  h.runner();
  h.tick();
  assert.equal(h.calls.length, 1);

  h.runner();
  h.tick();
  assert.equal(h.calls.length, 1, 'không đẻ thêm tiến trình khi lượt trước chưa xong');

  h.finish(0);
  h.tick();
  assert.equal(h.calls.length, 2, 'chạy bù đúng một lượt cho lần lưu vừa rồi');
});

test('máy chưa có script hoặc thư mục website thì bỏ qua, không làm hỏng việc lưu', () => {
  const h = harness({ exists: () => false });

  assert.doesNotThrow(() => h.runner());
  h.tick();
  assert.deepEqual(h.calls, [], 'không cố chạy thứ không tồn tại');
});

test('lifecycle của cài đặt website gọi prerender sau khi tạo và sau khi sửa', () => {
  const file = path.join(root, 'dha-cms/src/api/site-setting/content-types/site-setting/lifecycles.js');
  const source = fs.readFileSync(file, 'utf8');

  assert.match(source, /afterUpdate/, 'chạy lại sau khi sửa cài đặt');
  assert.match(source, /afterCreate/, 'chạy lại cả lần đầu tạo bản ghi');
});
