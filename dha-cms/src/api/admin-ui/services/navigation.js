'use strict';

const { sendError } = require('./errors');
const auth = require('./auth');
const { getDefaultNavItems } = require('../../navigation/default-items');

const NAV_UID = 'api::navigation.navigation';

const MAX_TOP_LEVEL_ITEMS = 20;
const MAX_CHILDREN_PER_ITEM = 20;
const MAX_LABEL_LENGTH = 100;
const MAX_URL_LENGTH = 500;

// Menu chỉ hiển thị đường dẫn nội bộ hoặc liên kết ngoài http(s). Chặn
// `javascript:` và `data:` ở đây vì nhãn/URL được ghi thẳng vào DOM trên
// website công khai.
function normalizeUrl(raw) {
  const url = String(raw == null ? '' : raw).trim();
  if (!url) return null;
  if (url.length > MAX_URL_LENGTH) return null;
  // "//vi-du.vn" và "/\\vi-du.vn" trông như đường dẫn trong website nhưng
  // trình duyệt hiểu là một tên miền khác — khách bấm menu là rời khỏi website.
  if (/^\/[/\\]/.test(url)) return null;
  if (url.startsWith('/') || url.startsWith('#')) return url;
  if (/^https?:\/\/\S+$/i.test(url)) return url;
  return null;
}

function slugifyId(label, index) {
  const base = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `muc-${index + 1}`;
}

function normalizeItem(raw, index, path, usedIds, errors) {
  const where = path ? `${path} › mục ${index + 1}` : `Mục ${index + 1}`;

  const label = String(raw && raw.label != null ? raw.label : '').trim();
  if (!label) {
    errors.push(`${where}: thiếu tên hiển thị.`);
    return null;
  }
  if (label.length > MAX_LABEL_LENGTH) {
    errors.push(`${where}: tên hiển thị quá ${MAX_LABEL_LENGTH} ký tự.`);
    return null;
  }

  const url = normalizeUrl(raw && raw.url);
  if (!url) {
    errors.push(`${where}: đường dẫn phải bắt đầu bằng "/", "#" hoặc "http".`);
    return null;
  }

  let id = String(raw && raw.id ? raw.id : '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!id) id = slugifyId(label, index);
  while (usedIds.has(id)) id = `${id}-${usedIds.size + 1}`;
  usedIds.add(id);

  return {
    id,
    label,
    url,
    visible: raw && raw.visible === false ? false : true,
    children: [],
  };
}

// Trả về { items, errors }. Cây chỉ sâu đúng 2 cấp: mục con của mục con bị bỏ.
function normalizeTree(rawItems) {
  const errors = [];
  const usedIds = new Set();

  if (!Array.isArray(rawItems)) {
    return { items: [], errors: ['Dữ liệu menu không hợp lệ.'] };
  }
  if (rawItems.length > MAX_TOP_LEVEL_ITEMS) {
    return { items: [], errors: [`Menu chỉ được tối đa ${MAX_TOP_LEVEL_ITEMS} mục cấp 1.`] };
  }

  const items = [];
  rawItems.forEach((rawItem, index) => {
    const item = normalizeItem(rawItem, index, '', usedIds, errors);
    if (!item) return;

    const rawChildren = Array.isArray(rawItem && rawItem.children) ? rawItem.children : [];
    if (rawChildren.length > MAX_CHILDREN_PER_ITEM) {
      errors.push(`${item.label}: chỉ được tối đa ${MAX_CHILDREN_PER_ITEM} mục con.`);
      return;
    }
    rawChildren.forEach((rawChild, childIndex) => {
      const child = normalizeItem(rawChild, childIndex, item.label, usedIds, errors);
      if (child) item.children.push(child);
    });

    items.push(item);
  });

  if (!errors.length && !items.length) {
    errors.push('Menu phải có ít nhất một mục.');
  }

  return { items, errors };
}

async function readRecord() {
  const entries = await strapi.documents(NAV_UID).findMany({ limit: 1 });
  return (entries && entries[0]) || null;
}

function readItems(record) {
  const raw = record && record.items;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.items)) return raw.items;
  return [];
}

async function get(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;

  const record = await readRecord();
  const items = readItems(record);
  // Bản ghi chưa tồn tại (CMS mới dựng, seed chưa chạy) thì vẫn cho quản trị
  // sửa từ menu mặc định thay vì nhìn một danh sách rỗng.
  ctx.body = { data: { items: items.length ? items : getDefaultNavItems() } };
}

async function update(ctx) {
  const user = await auth.requireSession(ctx);
  if (!user) return;
  if (!auth.requireTrustedOrigin(ctx)) return;

  const body = ctx.request.body || {};
  const input = body.data || body;
  const { items, errors } = normalizeTree(input.items);

  if (errors.length) {
    return sendError(ctx, 400, 'VALIDATION_ERROR', errors[0], errors);
  }

  const record = await readRecord();
  const saved = record
    ? await strapi.documents(NAV_UID).update({ documentId: record.documentId, data: { items } })
    : await strapi.documents(NAV_UID).create({ data: { items } });

  ctx.body = { data: { items: readItems(saved) } };
}

module.exports = {
  get,
  update,
  normalizeTree,
  normalizeUrl,
};
