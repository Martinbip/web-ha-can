'use strict';

// Loại nào có cặp nháp/xuất bản lấy từ `options.draftAndPublish` trong schema
// Strapi cũ (dha-api/src/schemas/*.json); tests/api-sanity-types.test.js canh
// hai nơi khớp nhau. `ore` không có trong resource-config nên phải khai ở đây.
const TYPES = {
  news: { drafts: true },
  project: { drafts: true },
  service: { drafts: true },
  heroSlide: { drafts: true },
  workflowStep: { drafts: true },
  pricingAnalysis: { drafts: true },
  pricingSurvey: { drafts: true },
  ore: { drafts: true },
  product: { drafts: false },
  productCategory: { drafts: false },
  pricingPackage: { drafts: false },
  contactInquiry: { drafts: false },
  orderRequest: { drafts: false },
  siteSetting: { drafts: false, singletonId: 'siteSetting' },
  navigation: { drafts: false, singletonId: 'navigation' },
  // Id có dấu chấm: Sanity không trả loại document này cho truy vấn không token,
  // kể cả khi dataset lỡ để public (spec mục 3a).
  adminUser: { drafts: false, idPrefix: 'adminUser.' },
};

function getTypeOptions(type) {
  if (!Object.prototype.hasOwnProperty.call(TYPES, type)) {
    throw new Error(`Loại document không được khai báo: ${type}`);
  }
  return TYPES[type];
}

module.exports = { TYPES, getTypeOptions };
