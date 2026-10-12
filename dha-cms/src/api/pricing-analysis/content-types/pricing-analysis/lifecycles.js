'use strict';

// Biểu phí phân tích là các lựa chọn của ô "Yêu cầu kiểm định"
// trong form Dự toán, được prerender ghi sẵn vào HTML tĩnh. Lưu xong là ghi lại,
// không đợi deploy. Gọi qua đối tượng module (không destructure) để test thay được.
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
