'use strict';

const Koa = require('koa');
const { koaBody } = require('koa-body');

const { setStore } = require('./sanity/store-registry');
const { createCors } = require('./http/cors');
const { createAdminUiRouter } = require('./routes/admin-ui');
const { createPublicRouter, strapiError } = require('./routes/public');

function createApp({ store, config, logger = console }) {
  setStore(store);

  const app = new Koa();
  // Sau nginx phải tin X-Forwarded-For, nếu không mọi rate limit dồn về IP
  // của nginx và khoá tất cả quản trị viên cùng lúc.
  app.proxy = Boolean(config.isBehindProxy);
  // ctx.ips lấy từ trái sang phải trong X-Forwarded-For; nginx chỉ nối thêm
  // (proxy_add_x_forwarded_for) chứ không thay, nên phần tử trái nhất là do
  // client tự đặt. Giới hạn còn đúng một phần tử — cái nginx vừa thêm — thì
  // ctx.ip mới là IP thật của khách, không xoay được bằng XFF giả.
  if (app.proxy) app.maxIpsCount = 1;

  app.use(async (ctx, next) => {
    const started = Date.now();
    try {
      await next();
    } catch (err) {
      // Chỉ lộ ra ngoài khi chính middleware ném lỗi (http-errors/koa-body)
      // đánh dấu rõ expose === true. Lỗi khác — kể cả lỗi Sanity mang
      // statusCode 401/404 của riêng nó — không phải là lỗi "an toàn để
      // hiện", nên log phía server rồi trả 500 chung.
      const expose = err.expose === true;
      const status = expose ? Number(err.status || err.statusCode) || 500 : 500;
      if (!expose) logger.error(`[dha-api] ${ctx.method} ${ctx.path}`, err);
      ctx.status = status;
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
  // multipart tắt ở tầng toàn cục: chỉ route upload ảnh mới cần, và bật ở mọi
  // route POST từng khiến formidable ghi tệp tạm vào os.tmpdir() không giới
  // hạn kể cả với request ẩn danh hay route không tồn tại (xem admin-ui.js).
  app.use(koaBody({
    multipart: false,
    jsonLimit: '1mb',
    formLimit: '1mb',
    textLimit: '1mb',
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
