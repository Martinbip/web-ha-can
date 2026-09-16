'use strict';

// Danh sách ô của từng trang. Nhãn tiếng Việt nằm ở admin
// (admin/src/config/page-content-fields.js) — có test giữ hai bên khớp khoá.
const PAGE_CODES = ['home', 'products', 'projects', 'news', 'pricing', 'estimator', 'contact'];

const PAGE_FIELDS = {
  home: {
    hero_primary_label: { type: 'text', max: 60 },
    hero_primary_url: { type: 'url', max: 300 },
    hero_secondary_label: { type: 'text', max: 60 },
    hero_secondary_url: { type: 'url', max: 300 },
    prices_title: { type: 'text', max: 120 },
    prices_cta_label: { type: 'text', max: 60 },
    news_title: { type: 'text', max: 120 },
    news_link_label: { type: 'text', max: 60 },
    sidebar_categories_title: { type: 'text', max: 60 },
    products_tag: { type: 'text', max: 80 },
    products_title: { type: 'textarea', max: 120 },
    products_link_label: { type: 'text', max: 60 },
    services_tag: { type: 'text', max: 80 },
    services_title: { type: 'text', max: 120 },
    services_description: { type: 'textarea', max: 400 },
    workflow_tag: { type: 'text', max: 80 },
    workflow_title: { type: 'text', max: 120 },
    workflow_description: { type: 'textarea', max: 400 },
  },
  products: {
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
    cta_title: { type: 'text', max: 120 },
    cta_call_label: { type: 'text', max: 60 },
    cta_contact_label: { type: 'text', max: 60 },
  },
  projects: {
    tag: { type: 'text', max: 80 },
    title: { type: 'text', max: 120 },
    description: { type: 'textarea', max: 400 },
  },
  news: {
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
  },
  pricing: {
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
    cta_label: { type: 'text', max: 60 },
    survey_title: { type: 'text', max: 120 },
    survey_description: { type: 'textarea', max: 400 },
  },
  estimator: {
    tag: { type: 'text', max: 80 },
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
    note: { type: 'textarea', max: 600 },
    cta_label: { type: 'text', max: 60 },
  },
  contact: {
    title: { type: 'text', max: 120 },
    intro: { type: 'textarea', max: 400 },
    call_title: { type: 'text', max: 120 },
    commitments_title: { type: 'text', max: 80 },
    commitments: { type: 'text-list', max: 200 },
    success_title: { type: 'text', max: 120 },
    success_message: { type: 'textarea', max: 400 },
  },
};

const SEO_FIELDS = {
  title: { type: 'text', max: 70 },
  description: { type: 'textarea', max: 200 },
  image: { type: 'url', max: 500 },
  image_alt: { type: 'text', max: 150 },
};

function cleanString(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanField(value, field) {
  if (field.type === 'text-list') {
    if (!Array.isArray(value)) return null;
    const lines = value.map((line) => cleanString(line, field.max)).filter(Boolean);
    return lines.length ? lines : null;
  }
  return cleanString(value, field.max);
}

function cleanGroup(raw, fields) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, field] of Object.entries(fields)) {
    const value = cleanField(raw[key], field);
    if (value !== null) out[key] = value;
  }
  return out;
}

// Dữ liệu đến từ form admin, có thể mang khoá lạ hoặc kiểu sai (dữ liệu cũ, sửa
// tay). Lọc theo đúng khai báo rồi mới lưu; phần bỏ đi thì website giữ chữ mặc
// định trong HTML.
function sanitizePageContent(data) {
  const texts = {};
  const seo = {};
  for (const page of PAGE_CODES) {
    const pageTexts = cleanGroup(data?.texts?.[page], PAGE_FIELDS[page]);
    if (Object.keys(pageTexts).length) texts[page] = pageTexts;
    const pageSeo = cleanGroup(data?.seo?.[page], SEO_FIELDS);
    if (Object.keys(pageSeo).length) seo[page] = pageSeo;
  }
  return { texts, seo };
}

module.exports = { PAGE_CODES, PAGE_FIELDS, SEO_FIELDS, sanitizePageContent };
