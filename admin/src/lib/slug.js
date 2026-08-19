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
