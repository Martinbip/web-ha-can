// Chuẩn hoá địa chỉ mà biên tập viên gõ vào ô Liên kết.
//
// Phải khớp với bộ lọc của trang tin tức (isSafeArticleUrl trong app.js): chỉ
// http/https/mailto/tel và đường dẫn trong chính website. Gắn được một địa chỉ
// mà trang công khai lại bỏ đi thì biên tập viên tưởng đã xong, khách bấm vào
// không đi đâu cả.

// Giao thức nào cũng gõ được, nên phải nói rõ cái nào chấp nhận — chặn hẳn
// javascript: và data: thay vì tin rằng trang công khai sẽ lọc hộ.
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

// Chuỗi có dạng "abc@xyz.vn" thì gần như chắc chắn là email chứ không phải tên
// miền — người viết bài không phải nhớ gõ "mailto:" ở đầu.
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trả về địa chỉ đã chuẩn hoá, hoặc null nếu không dùng được.
 */
export function normalizeLinkHref(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // Đường dẫn trong chính website và link nhảy tới mục trong bài: giữ nguyên.
  // Ghép thêm "https://" vào đây sẽ đẻ ra "https:///products".
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;

  // Xét giao thức trước: "mailto:a@b.vn" cũng có dạng của một địa chỉ email,
  // đoán nhầm sẽ ra "mailto:mailto:a@b.vn".
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    const protocol = raw.slice(0, raw.indexOf(':') + 1).toLowerCase();
    return ALLOWED_PROTOCOLS.includes(protocol) ? raw : null;
  }

  if (LOOKS_LIKE_EMAIL.test(raw)) return `mailto:${raw}`;

  return `https://${raw}`;
}
