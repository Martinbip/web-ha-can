'use strict';

const { createClient } = require('@sanity/client');

// Sanity sập/chậm không được kéo sập toàn bộ dha-api: timeout ngắn + ít lần
// thử lại để một request lỗi trả về nhanh (cache.js phục vụ bản cache cũ),
// thay vì @sanity/client mặc định thử lại tới 5 lần mỗi request.
const SANITY_TIMEOUT_MS = 8000;
const SANITY_MAX_RETRIES = 1;

// Token chỉ ở server. `raw` để đọc được cả nháp (drafts.*) lẫn bản xuất bản;
// không dùng CDN vì cache của CDN làm admin sửa xong mà web chưa đổi.
function createSanityClient({ projectId, dataset, token, apiVersion }, { makeClient = createClient } = {}) {
  return makeClient({
    projectId,
    dataset,
    token,
    apiVersion,
    useCdn: false,
    perspective: 'raw',
    timeout: SANITY_TIMEOUT_MS,
    maxRetries: SANITY_MAX_RETRIES,
  });
}

// Dataset chứa hash mật khẩu và thông tin cá nhân của khách. Truy vấn không
// token mà đếm được document riêng tư là dataset đang public → dừng ngay
// (spec mục 3a). Dataset private trả 0 hoặc từ chối (401/403).
const PRIVATE_PROBE = 'count(*[_type in ["contactInquiry", "orderRequest", "adminUser"]])';

// Bước 1 — probe ẩn danh: fail-closed. Trước đây so `visible > 0`, mà
// `null > 0` và `{} > 0` đều là false nên một probe trả về rỗng/không rõ ràng
// (dataset lỗi, trả JSON khác dạng...) vẫn "qua" được — đúng lỗi cần một
// dataset public còn trống để lọt lưới. Giờ bất cứ kết quả nào không phải số
// sạch (và probe không bị từ chối 401/403) đều bị coi là đáng ngờ và chặn.
function assertProbeClean(dataset, visible) {
  if (!Number.isFinite(visible) || visible > 0) {
    throw new Error(
      `Dataset "${dataset}" đang public hoặc probe trả kết quả không rõ ràng (${JSON.stringify(visible)}): `
      + 'truy vấn không token phải trả về đúng số 0. '
      + `Chuyển sang private: npx sanity@latest dataset visibility set ${dataset} private`,
    );
  }
}

// Bước 2 — xác thực có token: probe ẩn danh chỉ nói "không đọc được gì", chứ
// không chứng minh dataset thật sự private (vd. dataset trống nhưng public
// vẫn qua probe). Dùng token hỏi thẳng Sanity aclMode của dataset.
async function assertAclModePrivate({ projectId, dataset, apiVersion, token }, makeClient) {
  const authed = makeClient({ projectId, dataset, apiVersion, token, useCdn: false });
  let datasets;
  try {
    datasets = await authed.datasets.list();
  } catch (err) {
    throw new Error(`Không xác thực được dataset "${dataset}" là private (không đọc được danh sách dataset): ${err.message}`);
  }
  const entry = Array.isArray(datasets) ? datasets.find((item) => item.name === dataset) : null;
  if (!entry) {
    throw new Error(`Không thấy dataset "${dataset}" trong danh sách dataset của project — không xác thực được là private.`);
  }
  if (entry.aclMode !== 'private') {
    throw new Error(`Dataset "${dataset}" có aclMode "${entry.aclMode}", phải là "private".`);
  }
}

async function assertDatasetPrivate({ projectId, dataset, apiVersion, token }, { makeClient = createClient } = {}) {
  const anonymous = makeClient({ projectId, dataset, apiVersion, useCdn: false });
  try {
    const visible = await anonymous.fetch(PRIVATE_PROBE);
    assertProbeClean(dataset, visible);
  } catch (err) {
    if (!(err.statusCode === 401 || err.statusCode === 403)) throw err;
    // Probe bị chặn hẳn — dấu hiệu tốt, nhưng vẫn phải xác thực aclMode thật
    // sự bằng token bên dưới trước khi kết luận private.
  }

  await assertAclModePrivate({ projectId, dataset, apiVersion, token }, makeClient);
}

module.exports = { createSanityClient, assertDatasetPrivate };
