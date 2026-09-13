'use strict';

// Mọi lời gọi CMS của app.js, preview.html và scripts/*.js — giữ nguyên chuỗi
// query để so đúng thứ trình duyệt đang xin. tests/api-compare.test.js canh
// danh sách này không bị thiếu khi app.js thêm lời gọi mới.
const PUBLIC_ENDPOINTS = [
  { path: 'site-setting' },
  { path: 'navigation' },
  { path: 'product-categories?sort=sort_order:asc&pagination[limit]=100' },
  { path: 'hero-slides?sort=sort_order:asc&pagination[limit]=100' },
  { path: 'services?sort=sort_order:asc&pagination[limit]=100' },
  { path: 'workflow-steps?sort=sort_order:asc&pagination[limit]=100' },
  { path: 'pricing-packages?pagination[limit]=100', unordered: true },
  { path: 'pricing-surveys?pagination[limit]=100', unordered: true },
  { path: 'pricing-analyses?pagination[limit]=100', unordered: true },
  { path: 'news-articles?pagination[limit]=100&sort=date:desc' },
  { path: 'news-articles?pagination[limit]=200&sort=date:desc' },
  { path: 'news-articles?pagination[pageSize]=500&sort=date:desc' },
  { path: 'products?sort=sort_order:asc&pagination[limit]=500' },
  { path: 'products?pagination[limit]=500', unordered: true },
  { path: 'ores?sort=name:asc&pagination[limit]=100' },
  { path: 'projects?sort=publishedAt:desc&pagination[limit]=100' },
];

// preview.html đọc từng bản ghi theo documentId ở các collection này. `news`
// (không phải news-articles) giữ nguyên để xác nhận lỗi 404 đã biết là như
// nhau ở hai bên (spec mục 1).
const DETAIL_COLLECTIONS = ['hero-slides', 'services', 'workflow-steps', 'products', 'projects', 'news', 'news-articles'];

const ADMIN_TYPES = [
  'news', 'products', 'product-categories', 'projects', 'services', 'hero-slides', 'workflow-steps',
  'pricing-packages', 'pricing-analyses', 'pricing-surveys', 'site-setting', 'contact-inquiries', 'order-requests',
];

module.exports = { PUBLIC_ENDPOINTS, DETAIL_COLLECTIONS, ADMIN_TYPES };
