'use strict';

// Giá, đơn vị và danh mục của sản phẩm quyết định danh sách quặng
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
