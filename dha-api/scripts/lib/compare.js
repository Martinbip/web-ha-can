'use strict';

// Khác biệt được phép giữa Strapi và dha-api: `id` (số nguyên ↔ documentId) và
// `updatedAt` (import làm mới _updatedAt) của bản ghi (object có documentId).
// Mọi thứ khác phải khớp, kể cả id của các thành phần lồng (ví dụ: mục menu).
const RECORD_IGNORED_KEYS = new Set(['id', 'updatedAt']);

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    // Chỉ bỏ id/updatedAt nếu đây là bản ghi (có documentId)
    const isRecord = 'documentId' in value;
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => !(isRecord && RECORD_IGNORED_KEYS.has(key)))
        .sort()
        .map((key) => [key, normalize(value[key])]),
    );
  }
  return value;
}

function diffJson(left, right, { limit = 20 } = {}, pathLabel = '$', out = []) {
  if (out.length >= limit) return out;
  const bothObjects = left && right && typeof left === 'object' && typeof right === 'object';
  if (!bothObjects || Array.isArray(left) !== Array.isArray(right)) {
    if (JSON.stringify(left) !== JSON.stringify(right)) out.push({ path: pathLabel, left, right });
    return out;
  }
  if (Array.isArray(left)) {
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i += 1) diffJson(left[i], right[i], { limit }, `${pathLabel}[${i}]`, out);
    return out;
  }
  for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    diffJson(left[key], right[key], { limit }, `${pathLabel}.${key}`, out);
  }
  return out;
}

function sortedByDocumentId(body) {
  if (!body || !Array.isArray(body.data)) return body;
  return { ...body, data: body.data.slice().sort((a, b) => String(a.documentId).localeCompare(String(b.documentId))) };
}

function compareResponses(left, right, { unordered = false } = {}) {
  const a = normalize(left);
  const b = normalize(right);
  const differences = diffJson(a, b);
  if (!differences.length || !unordered) return { differences, orderOnly: false };

  const asSets = diffJson(sortedByDocumentId(a), sortedByDocumentId(b));
  return asSets.length ? { differences: asSets, orderOnly: false } : { differences: [], orderOnly: true };
}

module.exports = { normalize, diffJson, compareResponses };
