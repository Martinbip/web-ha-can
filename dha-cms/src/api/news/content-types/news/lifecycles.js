'use strict';

// Mỗi bài đã đăng có một trang HTML tĩnh riêng (/tin-tuc/<slug>/) mang sẵn
// tiêu đề, mô tả và ảnh để Facebook/Zalo đọc được khi chia sẻ — những trình đọc
// này không chạy JavaScript. Lưu, đăng, gỡ hay xoá bài là ghi lại ngay, không
// đợi deploy. Gọi qua đối tượng module (không destructure) để test thay được.
const prerender = require('../../../site-setting/prerender');

module.exports = {
  afterCreate() {
    prerender.schedulePrerender();
  },

  afterUpdate() {
    prerender.schedulePrerender();
  },

  afterDelete() {
    prerender.schedulePrerender();
  },
};
