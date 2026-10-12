'use strict';

// Danh sách Nhu cầu do quản trị sửa trong "Dự toán & Liên hệ". Chốt luôn tên
// Nhu cầu vào yêu cầu lúc khách gửi: sau này quản trị đổi tên hay xoá mục thì
// yêu cầu cũ vẫn đọc được. Tên do khách tự gửi lên không được tin.
const { resolveContactService } = require('../../../form-config/fields');

async function loadServices() {
  try {
    const config = await strapi.db.query('api::form-config.form-config').findOne({});
    return config?.contact_services || null;
  } catch {
    return null;
  }
}

module.exports = {
  async beforeCreate(event) {
    const data = event.params?.data;
    if (!data) return;
    Object.assign(data, resolveContactService(data.service, await loadServices()));
  },
};
