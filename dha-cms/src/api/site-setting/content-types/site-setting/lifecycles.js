'use strict';

// Lưu cài đặt xong là ghi luôn vào HTML tĩnh, để website không phải chờ lần
// deploy sau mới hết chớp nội dung cũ. Xem ../../prerender.js.
const { schedulePrerender } = require('../../prerender');

module.exports = {
  afterCreate() {
    schedulePrerender();
  },

  afterUpdate() {
    schedulePrerender();
  },
};
