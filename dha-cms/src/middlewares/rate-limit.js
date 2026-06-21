'use strict';

const rateCounters = new Map();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 10;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateCounters) {
    if (now - entry.start > WINDOW_MS) {
      rateCounters.delete(key);
    }
  }
}, 60 * 1000);

module.exports = (config, { strapi }) => {
  const windowMs = (config && config.windowMs) || WINDOW_MS;
  const max = (config && config.max) || MAX_REQUESTS;

  return async (ctx, next) => {
    const ip = ctx.request.ip || ctx.ip || 'unknown';
    const key = `${ip}:${ctx.request.path}`;
    const now = Date.now();

    let entry = rateCounters.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { count: 0, start: now };
      rateCounters.set(key, entry);
    }

    entry.count++;

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
};
