'use strict';

// Cache kết quả đọc theo type, sống trong tiến trình. Chỉ dha-api ghi vào
// dataset (pm2 instances: 1), nên xoá sạch cache mỗi lần ghi là đủ để admin sửa
// xong web đổi ngay. TTL chỉ để bắt thay đổi từ nơi khác (import, Studio) và
// giữ số request lên Sanity thấp — gói free chặn cứng khi hết hạn mức.
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function createTypeCache({ load, ttlMs = DEFAULT_TTL_MS, now = Date.now }) {
  const entries = new Map();

  return {
    get(type) {
      const hit = entries.get(type);
      if (hit && now() - hit.at < ttlMs) return hit.promise;

      const promise = Promise.resolve().then(() => load(type));
      entries.set(type, { at: now(), promise });
      // Lỗi không được nằm lại trong cache: lần đọc sau phải thử lại.
      promise.catch(() => {
        if (entries.get(type)?.promise === promise) entries.delete(type);
      });
      return promise;
    },

    invalidate() {
      entries.clear();
    },
  };
}

module.exports = { createTypeCache, DEFAULT_TTL_MS };
