'use strict';

// Đọc cấu hình một lần lúc khởi động. Thiếu biến bắt buộc thì dừng ngay với
// thông báo nêu đủ tên biến, thay vì chạy được nửa chừng rồi lỗi ở request đầu.
const REQUIRED = ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_API_TOKEN', 'ADMIN_UI_SESSION_SECRET'];
const SANITY_API_VERSION = '2025-02-19';

function parseBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
  }

  const port = Number(env.PORT || 1337);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT không hợp lệ: ${env.PORT}`);
  }

  return {
    port,
    // Production nghe nội bộ, nginx đứng trước — lỡ quên đặt HOST thì vẫn an
    // toàn thay vì nghe ra ngoài Internet. Môi trường khác (dev) vẫn 0.0.0.0
    // để truy cập được từ máy khác trong mạng LAN/container.
    host: env.HOST || (env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'),
    // nginx đứng trước ở production. Không tin proxy thì mọi khách mang IP của
    // nginx và mọi rate limit dồn chung một bucket (xem spec mục 5).
    isBehindProxy: parseBoolean(env.IS_BEHIND_PROXY, env.NODE_ENV === 'production'),
    frontendUrl: env.FRONTEND_URL || null,
    sanity: {
      projectId: env.SANITY_PROJECT_ID,
      dataset: env.SANITY_DATASET,
      token: env.SANITY_API_TOKEN,
      apiVersion: SANITY_API_VERSION,
    },
  };
}

module.exports = { loadConfig, SANITY_API_VERSION };
