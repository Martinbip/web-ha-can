'use strict';

// Lưu cài đặt xong là ghi luôn vào HTML tĩnh, để website không phải chờ lần
// deploy sau mới hết chớp nội dung cũ. Xem ./prerender.js. Gọi qua đối tượng
// module (không destructure) để test thay được hàm này.
const prerender = require('./prerender');

module.exports = {
  afterCreate() {
    prerender.schedulePrerender();
  },

  afterUpdate() {
    prerender.schedulePrerender();
  },
};
