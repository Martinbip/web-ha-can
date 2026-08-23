'use strict';

// Ghi cài đặt vừa lưu vào HTML tĩnh ngay, không đợi lần deploy sau.
//
// HTML trong repo chứa nội dung mẫu; scripts/prerender-site-settings.js ghi đè
// bằng dữ liệu CMS lúc deploy để khách vào lần đầu không thấy nội dung mẫu chớp
// qua. Nhưng quản trị đổi hotline giữa hai lần deploy thì HTML lại cũ — nên lưu
// xong là chạy lại luôn.
//
// Script nằm ngoài thư mục Strapi (chỉ có trên máy chủ website), nên máy dev
// không có gì để chạy: thiếu đường dẫn thì lặng lẽ bỏ qua.
const nodeFs = require('node:fs');
const nodeChildProcess = require('node:child_process');

const DEFAULT_SCRIPT = process.env.PRERENDER_SCRIPT
  || '/var/www/web-ha-can/scripts/prerender-site-settings.js';
const DEFAULT_HTML_DIR = process.env.SITE_HTML_DIR || '/var/www/dhakimloaimau.vn';

// Hoãn một nhịp rồi mới chạy: vừa để dữ liệu kịp ghi hẳn xuống CSDL (script đọc
// lại qua HTTP nên phải thấy bản mới), vừa gộp mấy lần bấm Lưu liên tiếp.
const DEFAULT_DELAY_MS = 1500;

function createPrerenderRunner({
  script = DEFAULT_SCRIPT,
  htmlDir = DEFAULT_HTML_DIR,
  delayMs = DEFAULT_DELAY_MS,
  exists = (target) => nodeFs.existsSync(target),
  spawn = nodeChildProcess.spawn,
  log = console,
  setTimeout: schedule = setTimeout,
} = {}) {
  let waiting = false;
  let running = false;
  let pending = false;

  function start() {
    const child = spawn('node', [script, htmlDir], { stdio: 'ignore' });
    running = true;

    child.on('error', (err) => {
      running = false;
      log.warn?.(`[site-setting] không chạy được prerender: ${err.message}`);
    });

    child.on('close', (code) => {
      running = false;
      if (code !== 0) log.warn?.(`[site-setting] prerender kết thúc với mã ${code}`);
      // Có người lưu tiếp trong lúc đang chạy: chạy bù đúng một lượt.
      if (pending) {
        pending = false;
        run();
      }
    });

    child.unref?.();
  }

  function run() {
    if (!exists(script) || !exists(htmlDir)) return false;
    if (running) {
      pending = true;
      return false;
    }
    if (waiting) return false;

    waiting = true;
    schedule(() => {
      waiting = false;
      if (running) {
        pending = true;
        return;
      }
      start();
    }, delayMs).unref?.();
    return true;
  }

  return run;
}

const schedulePrerender = createPrerenderRunner();

module.exports = { createPrerenderRunner, schedulePrerender };
