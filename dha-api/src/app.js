'use strict';

const Koa = require('koa');
const { koaBody } = require('koa-body');

const { setStore } = require('./sanity/store-registry');
const { createCors } = require('./http/cors');
const { createAdminUiRouter } = require('./routes/admin-ui');
const { createPublicRouter, strapiError } = require('./routes/public');

// media.js tự chặn ảnh > 5MB với thông báo tiếng Việt; formidable chỉ chặn
// phần vượt hẳn để không đọc tệp khổng lồ vào đĩa.
const MAX_MULTIPART_FILE_BYTES = 6 * 1024 * 1024;

function createApp({ store, config, logger = console }) {
  setStore(store);

  const app = new Koa();
  // Sau nginx phải tin X-Forwarded-For, nếu không mọi rate limit dồn về IP
  // của nginx và khoá tất cả quản trị viên cùng lúc.
  app.proxy = Boolean(config.isBehindProxy);

  app.use(async (ctx, next) => {
    const started = Date.now();
    try {
      await next();
    } catch (err) {
      const status = Number(err.status || err.statusCode) || 500;
      const expose = status < 500 && err.expose !== false;
      if (!expose) logger.error(`[dha-api] ${ctx.method} ${ctx.path}`, err);
      ctx.status = expose ? status : 500;
      ctx.body = {
        data: null,
        error: {
          status: ctx.status,
          name: expose ? err.name || 'BadRequestError' : 'InternalServerError',
          message: expose ? err.message : 'Internal Server Error',
          details: {},
        },
      };
    } finally {
      logger.info(`${ctx.method} ${ctx.path} ${ctx.status} ${Date.now() - started}ms`);
    }
  });

  app.use(createCors({ frontendUrl: config.frontendUrl }));
  app.use(koaBody({
    multipart: true,
    jsonLimit: '1mb',
    formLimit: '1mb',
    textLimit: '1mb',
    formidable: { maxFileSize: MAX_MULTIPART_FILE_BYTES },
  }));

  // admin-ui trước: route công khai /api/:collection/:documentId khớp cả
  // /api/admin-ui/meta.
  const adminUi = createAdminUiRouter();
  app.use(adminUi.routes());
  app.use(adminUi.allowedMethods());
  app.use(createPublicRouter().routes());

  app.use(async (ctx) => {
    if (ctx.path.startsWith('/api/')) strapiError(ctx, 404, 'NotFoundError', 'Not Found');
  });

  return app;
}

module.exports = { createApp };
