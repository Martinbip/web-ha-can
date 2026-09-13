'use strict';

// Service admin-ui trước đây gọi `strapi.documents()` qua biến toàn cục của
// Strapi. Giờ chúng lấy store qua đây: server gắn store Sanity thật, test gắn
// store giả trong bộ nhớ.
let current = null;

function setStore(store) {
  current = store || null;
}

function getStore() {
  if (!current) {
    throw new Error('Chưa khởi tạo store dữ liệu — gọi setStore() trước.');
  }
  return current;
}

module.exports = { setStore, getStore };
