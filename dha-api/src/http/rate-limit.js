'use strict';

// Port từ dha-cms/src/middlewares/rate-limit.js. Mỗi route tạo một bộ đếm
// riêng; khoá theo IP + đường dẫn. IP chỉ đúng khi app.proxy bật sau nginx.
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX = 10;

function createRateLimit({ windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX, now = Date.now } = {}) {
  const counters = new Map();

  // unref: không giữ event loop sống, nếu không `npm test` treo sau khi chạy xong.
  const sweepTimer = setInterval(() => {
    const current = now();
    for (const [key, entry] of counters) {
      if (current - entry.start > windowMs) counters.delete(key);
    }
  }, 60 * 1000);
  if (typeof sweepTimer.unref === 'function') sweepTimer.unref();

  return async function rateLimit(ctx, next) {
    const ip = ctx.request.ip || ctx.ip || 'unknown';
    const key = `${ip}:${ctx.path}`;
    const current = now();

    let entry = counters.get(key);
    if (!entry || current - entry.start > windowMs) {
      entry = { count: 0, start: current };
      counters.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: 'TooManyRequestsError',
          message: 'Too many requests, please try again later.',
        },
      };
      return;
    }

    await next();
  };
}

module.exports = { createRateLimit };
