'use strict';

// Cấu hình form Dự toán và Liên hệ được prerender ghi sẵn vào HTML tĩnh. Lọc dữ
// liệu trước khi lưu, và ghi lại HTML ngay sau khi lưu.
// Gọi prerender qua đối tượng module (không destructure) để test thay được.
const prerender = require('../../../site-setting/prerender');
const { sanitizeFormConfig } = require('../../fields');

function sanitizeEvent(event) {
  const data = event.params?.data;
  if (!data) return;
  Object.assign(data, sanitizeFormConfig(data));
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
