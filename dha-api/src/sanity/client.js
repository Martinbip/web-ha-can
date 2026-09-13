'use strict';

const { createClient } = require('@sanity/client');

// Token chỉ ở server. `raw` để đọc được cả nháp (drafts.*) lẫn bản xuất bản;
// không dùng CDN vì cache của CDN làm admin sửa xong mà web chưa đổi.
function createSanityClient({ projectId, dataset, token, apiVersion }) {
  return createClient({ projectId, dataset, token, apiVersion, useCdn: false, perspective: 'raw' });
}

// Dataset chứa hash mật khẩu và thông tin cá nhân của khách. Truy vấn không
// token mà đếm được document riêng tư là dataset đang public → dừng ngay
// (spec mục 3a). Dataset private trả 0 hoặc từ chối (401/403).
const PRIVATE_PROBE = 'count(*[_type in ["contactInquiry", "orderRequest", "adminUser"]])';

async function assertDatasetPrivate({ projectId, dataset, apiVersion }, { makeClient = createClient } = {}) {
  const anonymous = makeClient({ projectId, dataset, apiVersion, useCdn: false });
  let visible;
  try {
    visible = await anonymous.fetch(PRIVATE_PROBE);
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) return;
    throw err;
  }
  if (visible > 0) {
    throw new Error(
      `Dataset "${dataset}" đang public: truy vấn không token đọc được ${visible} document riêng tư. `
      + `Chuyển sang private: npx sanity@latest dataset visibility set ${dataset} private`,
    );
  }
}

module.exports = { createSanityClient, assertDatasetPrivate };
