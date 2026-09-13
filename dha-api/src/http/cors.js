'use strict';

// Port từ dha-cms/config/middlewares.js (strapi::cors). So khớp nguyên origin
// đã parse bằng new URL — không so tiền tố. Một origin không parse được, kể
// cả origin đục (opaque) của trang sandbox hay tệp cục bộ, không bao giờ
// được mở, vì CORS ở đây có credentials.
const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD';
const HEADERS = 'Content-Type,Authorization,Origin,Accept';

function toOrigin(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function createCors({ frontendUrl } = {}) {
  const allowed = new Set([...DEFAULT_ORIGINS, frontendUrl].map(toOrigin).filter(Boolean));

  return async function cors(ctx, next) {
    const origin = ctx.get('Origin');
    const parsed = toOrigin(origin);
    const allowedOrigin = parsed && allowed.has(parsed) ? origin : null;

    if (allowedOrigin) {
      ctx.set('Access-Control-Allow-Origin', allowedOrigin);
      ctx.set('Access-Control-Allow-Credentials', 'true');
      ctx.vary('Origin');
    }

    if (ctx.method === 'OPTIONS') {
      if (allowedOrigin) {
        ctx.set('Access-Control-Allow-Methods', METHODS);
        ctx.set('Access-Control-Allow-Headers', HEADERS);
      }
      ctx.status = 204;
      return;
    }

    await next();
  };
}

module.exports = { createCors };
