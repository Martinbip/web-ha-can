'use strict';

// Nội dung trang hiện trên 7 trang và được prerender ghi sẵn vào HTML tĩnh.
// Lọc dữ liệu trước khi lưu, và ghi lại HTML ngay sau khi lưu.
// Gọi prerender qua đối tượng module (không destructure) để test thay được.
const prerender = require('../../../site-setting/prerender');
const { sanitizePageContent } = require('../../fields');

function sanitizeEvent(event) {
  const data = event.params?.data;
  if (!data) return;
  const clean = sanitizePageContent(data);
  // Lượt ghi có thể chỉ gửi một trong hai trường (gọi REST trực tiếp hoặc sửa
  // trong trang quản trị gốc của Strapi) — chỉ lọc trường có mặt, tránh tự
  // sinh trường còn lại thành {} và xoá trắng nó.
  if ('texts' in data) data.texts = clean.texts;
  if ('seo' in data) data.seo = clean.seo;
}

module.exports = {
  beforeCreate(event) {
    sanitizeEvent(event);
  },

  beforeUpdate(event) {
    sanitizeEvent(event);
  },

  afterCreate() {
    prerender.schedulePrerender();
  },

  afterUpdate() {
    prerender.schedulePrerender();
  },
};
