'use strict';

const { getTypeOptions } = require('../../src/sanity/types');

// Chuyển dữ liệu REST của Strapi 5 thành document Sanity (spec mục 7).
const DRAFT_PREFIX = 'drafts.';
const STRAPI_META = new Set(['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'locale', 'localizations', 'createdBy', 'updatedBy']);

const EXPORT_TYPES = [
  { path: 'news-articles', type: 'news' },
  { path: 'products', type: 'product' },
  { path: 'product-categories', type: 'productCategory' },
  { path: 'projects', type: 'project' },
  { path: 'services', type: 'service' },
  { path: 'hero-slides', type: 'heroSlide' },
  { path: 'workflow-steps', type: 'workflowStep' },
  { path: 'pricing-packages', type: 'pricingPackage' },
  { path: 'pricing-analyses', type: 'pricingAnalysis' },
  { path: 'pricing-surveys', type: 'pricingSurvey' },
  { path: 'ores', type: 'ore' },
  { path: 'contact-inquiries', type: 'contactInquiry' },
  { path: 'order-requests', type: 'orderRequest' },
  { path: 'site-setting', type: 'siteSetting' },
  { path: 'navigation', type: 'navigation' },
];

function isStrapiMedia(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && typeof value.url === 'string' && 'mime' in value;
}

function fieldsOf(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (STRAPI_META.has(key) || isStrapiMedia(value)) continue;
    out[key] = value;
  }
  return out;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function sameContent(left, right) {
  return JSON.stringify(stable(fieldsOf(left))) === JSON.stringify(stable(fieldsOf(right)));
}

function toSanityDocuments({ type, draftRows = [], publishedRows = [] }) {
  const options = getTypeOptions(type);
  const drafts = new Map(draftRows.map((item) => [item.documentId, item]));
  const published = new Map(publishedRows.map((item) => [item.documentId, item]));
  const documentIds = new Set([...published.keys(), ...drafts.keys()]);
  const docs = [];

  for (const documentId of documentIds) {
    const pub = published.get(documentId);
    const draft = drafts.get(documentId);
    const id = options.singletonId || documentId;

    if (options.drafts) {
      if (pub) docs.push({ _id: id, _type: type, ...fieldsOf(pub), createdAt: pub.createdAt, publishedAt: pub.publishedAt });
      if (draft && (!pub || !sameContent(draft, pub))) {
        docs.push({ _id: DRAFT_PREFIX + id, _type: type, ...fieldsOf(draft), createdAt: draft.createdAt || (pub && pub.createdAt) });
      }
    } else {
      const source = pub || draft;
      docs.push({ _id: id, _type: type, ...fieldsOf(source), createdAt: source.createdAt, publishedAt: source.publishedAt || source.createdAt });
    }
  }
  return docs;
}

// Chỉ project còn trường media `image` từ thời trước Cloudinary (đã kiểm mọi
// schema.json). app.js ưu tiên cloudinary_image_url, nên chuyển ảnh sang đó.
function planProjectImage(row) {
  if (row.cloudinary_image_url || !isStrapiMedia(row.image)) return null;
  const { url, provider_metadata: meta } = row.image;
  if (/^https?:\/\//.test(url)) {
    return { patch: { cloudinary_image_url: url, cloudinary_public_id: (meta && meta.public_id) || null } };
  }
  return { upload: url };
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Hàng của bảng admin_users trong SQLite của Strapi. Hash bcrypt chép nguyên để
// quản trị viên đăng nhập bằng mật khẩu cũ.
function adminUsersToDocs(rows) {
  const docs = [];
  const skipped = [];
  for (const user of rows) {
    const email = String(user.email || '').trim().toLowerCase();
    if (!user.password || !email) {
      skipped.push(email || String(user.document_id));
      continue;
    }
    docs.push({
      _id: `adminUser.${user.document_id}`,
      _type: 'adminUser',
      email,
      passwordHash: user.password,
      firstname: user.firstname || '',
      lastname: user.lastname || '',
      isActive: Boolean(user.is_active) && !user.blocked,
      createdAt: toIso(user.created_at),
    });
  }
  return { docs, skipped };
}

function summarize(docs) {
  const out = {};
  for (const doc of docs) {
    const bucket = out[doc._type] || (out[doc._type] = { published: 0, drafts: 0 });
    if (doc._id.startsWith(DRAFT_PREFIX)) bucket.drafts += 1;
    else bucket.published += 1;
  }
  return out;
}

module.exports = { EXPORT_TYPES, toSanityDocuments, adminUsersToDocs, planProjectImage, summarize, fieldsOf };
