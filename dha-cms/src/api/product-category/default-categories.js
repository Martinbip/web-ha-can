'use strict';

// Danh mục mặc định nằm trong code chứ không ở data/ như các seed khác: khi
// deploy, chỉ thư mục dha-cms/ được rsync sang máy chủ Strapi nên file seed ở
// gốc repo không tồn tại ở đó. Ba danh mục này đúng bằng 3 tab từng viết cứng
// trong HTML trang chủ, để website sau khi nâng cấp trông y như trước.
const DEFAULT_CATEGORIES = [
  { slug: 'color-metal', name: 'Kim Loại Màu', visible: true, sort_order: 1 },
  { slug: 'black-metal', name: 'Kim Loại Đen', visible: true, sort_order: 2 },
  { slug: 'rare-earth', name: 'Đất Hiếm', visible: true, sort_order: 3 },
];

// Sản phẩm cũ chưa hề được gán danh mục. Suy ra danh mục ban đầu bằng đúng luật
// mà app.js dùng trước đây, để lần deploy này không làm trống trang sản phẩm.
// Quản trị sửa lại thoải mái sau đó — hàm này chỉ chạy khi trường còn trống.
function guessCategories(product) {
  const uid = String(product?.uid || '').toLowerCase();
  const name = String(product?.name || '').toLowerCase();
  const group = product?.group;

  if (group === 'rare-earth' || uid.includes('dat-hiem') || name.includes('đất hiếm')) {
    return ['rare-earth'];
  }
  if (group === 'quang' && (uid.includes('sat') || name.includes('sắt'))) {
    return ['black-metal'];
  }
  if (['dong', 'nhom', 'chi', 'thiec'].includes(group) || uid === 'quang-dong-tho') {
    return ['color-metal'];
  }
  return [];
}

module.exports = { DEFAULT_CATEGORIES, guessCategories };
