'use strict';

// Menu mặc định nằm trong code chứ không nằm ở data/ như các seed khác: khi
// deploy, chỉ thư mục dha-cms/ được rsync sang máy chủ Strapi, nên file seed ở
// gốc repo không tồn tại ở đó. Đây cũng chính là 8 mục viết sẵn trong HTML.
const DEFAULT_NAV_ITEMS = [
  { id: 'home', label: 'Trang Chủ', url: '/', visible: true, children: [] },
  { id: 'services', label: 'Dịch Vụ', url: '/#services', visible: true, children: [] },
  { id: 'products', label: 'Sản Phẩm', url: '/products', visible: true, children: [] },
  { id: 'estimator', label: 'Dự Tính Chi Phí', url: '/estimator', visible: true, children: [] },
  { id: 'pricing', label: 'Báo Giá', url: '/pricing', visible: true, children: [] },
  { id: 'workflow', label: 'Quy Trình', url: '/#workflow', visible: true, children: [] },
  { id: 'projects', label: 'Dự Án', url: '/projects', visible: true, children: [] },
  { id: 'contact', label: 'Liên Hệ', url: '/contact', visible: true, children: [] },
];

function getDefaultNavItems() {
  return DEFAULT_NAV_ITEMS.map((item) => ({ ...item, children: [...item.children] }));
}

module.exports = { DEFAULT_NAV_ITEMS, getDefaultNavItems };
