// Đường dẫn bài viết (slug) do hệ thống sinh ra từ tiêu đề, không bắt biên tập
// viên tự gõ: Strapi khai báo trường này kiểu `uid` nên chỉ nhận chữ thường,
// số và dấu gạch ngang — dán nguyên link web vào sẽ bị từ chối vì "ký tự lạ".
const VIETNAMESE_MARKS = /[̀-ͯ]/g;

export function slugify(input) {
  const raw = String(input || '')
    .normalize('NFD')
    .replace(VIETNAMESE_MARKS, '')
    // đ/Đ không tách được bằng NFD nên phải thay tay.
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();

  return raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

// Người dùng thường dán cả URL ("https://dhakimloaimau.vn/tin-tuc/abc" hoặc
// "dhakimloaimau.vn.com"). Lấy phần cuối đường dẫn rồi mới chuẩn hoá, để thao
// tác dán vẫn cho ra một slug dùng được thay vì báo lỗi.
export function normalizeSlugInput(input) {
  const value = String(input || '').trim();
  if (!value) return '';

  const withoutProtocol = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const withoutQuery = withoutProtocol.split(/[?#]/)[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  const last = segments.length > 1 ? segments[segments.length - 1] : withoutQuery;

  return slugify(last.replace(/\.(html?|php|aspx?)$/i, ''));
}
