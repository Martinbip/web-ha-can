'use strict';

// Lọc / sắp xếp / chọn trường trong bộ nhớ, đúng ngữ nghĩa Document Service của
// Strapi mà admin-ui và API công khai dựa vào. Không dịch sang GROQ vì GROQ
// không có phép "chứa chuỗi con, không phân biệt hoa thường" — `match` tách theo
// từ. Dữ liệu nhỏ (spec mục 4) nên lọc tại chỗ là đủ nhanh.

const OPERATORS = {
  $eq: (value, operand) => value === operand,
  $in: (value, operand) => Array.isArray(operand) && operand.includes(value),
  $null: (value, operand) => (operand ? value == null : value != null),
  $contains: (value, operand) => String(value ?? '').includes(String(operand)),
  $containsi: (value, operand) =>
    String(value ?? '').toLowerCase().includes(String(operand).toLowerCase()),
  $gte: (value, operand) => value != null && new Date(value) >= new Date(operand),
};

function isCondition(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function unsupported(operator) {
  return new Error(`Toán tử lọc không hỗ trợ: ${operator}`);
}

function matchesFilters(entry, filters) {
  if (!filters) return true;
  return Object.entries(filters).every(([key, condition]) => {
    if (key === '$or') return Array.isArray(condition) && condition.some((sub) => matchesFilters(entry, sub));
    if (key === '$and') return Array.isArray(condition) && condition.every((sub) => matchesFilters(entry, sub));
    if (key.startsWith('$')) throw unsupported(key);

    if (isCondition(condition)) {
      return Object.entries(condition).every(([operator, operand]) => {
        const check = OPERATORS[operator];
        if (!check) throw unsupported(operator);
        return check(entry[key], operand);
      });
    }
    return entry[key] === condition;
  });
}

function normalizeSort(sort) {
  if (!sort) return [];
  const list = Array.isArray(sort) ? sort : [sort];
  return list
    .flatMap((item) => Object.entries(item || {}))
    .map(([field, direction]) => [field, String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc']);
}

// NULL nhỏ nhất, như SQLite mà Strapi đang chạy.
function compareValues(left, right) {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  return left < right ? -1 : 1;
}

function sortEntries(entries, sort) {
  const keys = normalizeSort(sort);
  const copy = entries.slice();
  if (!keys.length) return copy;
  return copy.sort((a, b) => {
    for (const [field, direction] of keys) {
      const result = compareValues(a[field], b[field]);
      if (result) return direction === 'desc' ? -result : result;
    }
    return 0;
  });
}

function pickFields(entry, fields) {
  if (!fields || !fields.length) return { ...entry };
  const picked = { id: entry.id, documentId: entry.documentId };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(entry, field)) picked[field] = entry[field];
  }
  return picked;
}

module.exports = { matchesFilters, sortEntries, pickFields };
