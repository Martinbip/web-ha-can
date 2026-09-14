'use strict';

// Menu đầu trang được prerender ghi sẵn vào HTML tĩnh (xem
// scripts/prerender-site-settings.js). Lưu xong là ghi lại, không đợi deploy.
// Gọi qua đối tượng module (không destructure) để test thay được hàm này.
const prerender = require('../../../site-setting/prerender');

module.exports = {
  afterCreate() {
    prerender.schedulePrerender();
  },

  afterUpdate() {
    prerender.schedulePrerender();
  },
};
