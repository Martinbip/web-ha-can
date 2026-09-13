'use strict';

// Đọc cú pháp query REST của Strapi 5 mà app.js, preview.html và scripts/*.js
// đang gửi. Giới hạn giống dha-cms/config/api.js: mặc định 25, trần 100.
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const FILTER_KEY = /^filters\[([^\]]+)\](?:\[(\$[a-z]+)\](?:\[(\d+)\])?)?$/;
const MAX_IN_VALUES = 100;
const ALLOWED_OPERATORS = new Set(['$eq', '$in', '$null', '$contains', '$containsi', '$gte']);

class QueryError extends Error {}

function toInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function clampLimit(value) {
  const parsed = toInteger(value, DEFAULT_LIMIT);
  if (parsed === -1) return MAX_LIMIT;
  if (parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function assertField(field) {
  if (!FIELD_NAME.test(field)) throw new QueryError(`Tên trường không hợp lệ: ${field}`);
}

function parseSort(value) {
  if (value === undefined || value === '') return [];
  const parts = (Array.isArray(value) ? value : [value]).flatMap((item) => String(item).split(','));
  return parts.map((part) => {
    const [field, direction = 'asc'] = part.trim().split(':');
    assertField(field);
    const normalized = direction.toLowerCase();
    if (normalized !== 'asc' && normalized !== 'desc') throw new QueryError(`Chiều sắp xếp không hợp lệ: ${direction}`);
    return { [field]: normalized };
  });
}

function parsePagination(query) {
  const page = query['pagination[page]'];
  const pageSize = query['pagination[pageSize]'];
  const start = query['pagination[start]'];
  const limit = query['pagination[limit]'];
  const usesOffset = start !== undefined || limit !== undefined;
  const usesPage = page !== undefined || pageSize !== undefined;

  if (usesOffset && usesPage) throw new QueryError('Không dùng lẫn page/pageSize với start/limit.');

  if (usesOffset) {
    return { mode: 'offset', start: Math.max(toInteger(start, 0), 0), limit: clampLimit(limit ?? DEFAULT_LIMIT) };
  }
  const currentPage = Math.max(toInteger(page, 1), 1);
  const size = clampLimit(pageSize ?? DEFAULT_LIMIT);
  return { mode: 'page', page: currentPage, pageSize: size, start: (currentPage - 1) * size, limit: size };
}

function parseFilterValue(operator, value) {
  if (operator === '$null') return String(value).toLowerCase() === 'true';
  return String(value);
}

function parseFilters(query) {
  const filters = {};
  for (const [key, rawValue] of Object.entries(query)) {
    if (!key.startsWith('filters[')) continue;
    const match = key.match(FILTER_KEY);
    if (!match) throw new QueryError(`Bộ lọc không hợp lệ: ${key}`);
    const [, field, operator, index] = match;
    assertField(field);
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

    if (!operator) {
      filters[field] = String(value);
      continue;
    }
    if (!ALLOWED_OPERATORS.has(operator)) throw new QueryError(`Toán tử lọc không hỗ trợ: ${operator}`);

    const condition = filters[field] && typeof filters[field] === "object" ? filters[field] : {};
    if (operator === "$in") {
      const position = index === undefined ? (condition.$in || []).length : Number(index);
      if (position >= MAX_IN_VALUES) throw new QueryError(`Quá nhiều giá trị cho $in (tối đa ${MAX_IN_VALUES}).`);
      const list = condition.$in || [];
      list[position] = String(value);
      condition.$in = list.filter((item) => item !== undefined);
    } else {
      condition[operator] = parseFilterValue(operator, value);
    }
    filters[field] = condition;
  }
  return filters;
}

function parseStrapiQuery(query = {}) {
  return {
    sort: parseSort(query.sort),
    filters: parseFilters(query),
    pagination: parsePagination(query),
  };
}

function buildMeta(pagination, total) {
  if (pagination.mode === 'offset') {
    return { pagination: { start: pagination.start, limit: pagination.limit, total } };
  }
  return {
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      pageCount: Math.ceil(total / pagination.pageSize),
      total,
    },
  };
}

module.exports = { parseStrapiQuery, buildMeta, QueryError, DEFAULT_LIMIT, MAX_LIMIT };