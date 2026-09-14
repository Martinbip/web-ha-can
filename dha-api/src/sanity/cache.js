'use strict';

// Cache kết quả đọc theo type, sống trong tiến trình. Chỉ dha-api ghi vào
// dataset (pm2 instances: 1), nên xoá sạch cache mỗi lần ghi là đủ để admin sửa
// xong web đổi ngay. TTL chỉ để bắt thay đổi từ nơi khác (import, Studio) và
// giữ số request lên Sanity thấp — gói free chặn cứng khi hết hạn mức.
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function createTypeCache({ load, ttlMs = DEFAULT_TTL_MS, now = Date.now }) {
  const entries = new Map();
  // Bản đọc tốt gần nhất theo type — phao cứu sinh khi Sanity sập/chậm.
  // Không có bản này thì vẫn phải ném lỗi (chưa từng đọc được gì để phục vụ).
  const lastGood = new Map();

  return {
    get(type) {
      const hit = entries.get(type);
      if (hit && now() - hit.at < ttlMs) return hit.promise;

      const promise = Promise.resolve()
        .then(() => load(type))
        .then((value) => {
          lastGood.set(type, value);
          return value;
        })
        .catch((err) => {
          if (lastGood.has(type)) {
            // Sanity sập tạm thời: phục vụ bản cache cũ thay vì làm sập cả
            // request, và GIỮ NGUYÊN promise này trong `entries` cho tới hết
            // TTL — nếu không, mỗi request tới lại thử gọi Sanity một lần
            // nữa trong lúc nó đang sập (đúng lỗi ban đầu của mục 4).
            console.error(`[cache] nạp lại "${type}" lỗi, dùng bản cache gần nhất: ${err.message}`);
            return lastGood.get(type);
          }
          // Chưa từng có bản tốt: không gì để phục vụ, phải ném lỗi. Xoá khỏi
          // cache để lần đọc kế tiếp thử lại ngay, không phải đợi hết TTL.
          if (entries.get(type)?.promise === promise) entries.delete(type);
          throw err;
        });

      entries.set(type, { at: now(), promise });
      return promise;
    },

    // Ghi xong phải buộc lần đọc sau chạm thẳng Sanity — không được coi
    // `lastGood` là đủ. `lastGood` chỉ là phao cứu sinh cho một lần nạp lại
    // bị lỗi, không phải cách né việc đọc dữ liệu mới sau khi ghi.
    invalidate() {
      entries.clear();
    },
  };
}

module.exports = { createTypeCache, DEFAULT_TTL_MS };
