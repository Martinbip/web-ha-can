'use strict';

const Router = require('@koa/router');
const { koaBody } = require('koa-body');

const auth = require('../services/auth');
const media = require('../services/media');
const resources = require('../services/resources');
const navigation = require('../services/navigation');
const { createRateLimit } = require('../http/rate-limit');

// media.js tự chặn ảnh > 5MB với thông báo tiếng Việt; formidable chỉ chặn
// phần vượt hẳn để không đọc tệp khổng lồ vào đĩa. multipart chỉ bật ở đúng
// route này — bật toàn cục từng khiến mọi POST (kể cả ẩn danh, route không
// tồn tại) đều bị formidable ghi tệp tạm vào os.tmpdir().
const MAX_MULTIPART_FILE_BYTES = 6 * 1024 * 1024;
const uploadBody = koaBody({
  multipart: true,
  formidable: { maxFiles: 1, maxFileSize: MAX_MULTIPART_FILE_BYTES },
});

// Đường dẫn giữ nguyên như route Strapi cũ (dha-cms/src/api/admin-ui/routes)
// vì admin/ gọi đúng các địa chỉ này. Kiểm tra phiên và nguồn yêu cầu nằm
// trong từng service, không nằm ở router.
function createAdminUiRouter() {
  const router = new Router({ prefix: '/api' });

  router.post('/admin-ui/auth/login', createRateLimit({ windowMs: 15 * 60 * 1000, max: 5 }), auth.login);
  router.get('/admin-ui/auth/me', auth.me);
  router.post('/admin-ui/auth/logout', auth.logout);
  router.get('/admin-ui/meta', resources.meta);
  router.get('/admin-ui/dashboard', resources.dashboard);
  router.get('/admin-ui/media', media.list);
  router.post('/admin-ui/media/upload', uploadBody, media.upload);
  router.delete('/admin-ui/media/:publicId', media.delete);
  router.get('/admin-ui/navigation', navigation.get);
  router.put('/admin-ui/navigation', navigation.update);
  router.get('/admin-ui/resources/:type', resources.list);
  router.post('/admin-ui/resources/:type', resources.create);
  router.get('/admin-ui/resources/:type/:id', resources.get);
  router.put('/admin-ui/resources/:type/:id', resources.update);
  router.delete('/admin-ui/resources/:type/:id', resources.delete);
  router.post('/admin-ui/resources/:type/:id/publish', resources.publish);
  router.post('/admin-ui/resources/:type/:id/unpublish', resources.unpublish);

  return router;
}

module.exports = { createAdminUiRouter };
