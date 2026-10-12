'use strict';

// Cấu hình form Dự toán và danh sách Nhu cầu của form Liên hệ. Giá trị mặc định
// nằm trong HTML (estimator.html, contact.html): ô nào lưu null hoặc danh sách
// rỗng thì website giữ nguyên mặc định đó.
const FORM_CONFIG_FIELDS = [
  'packaging',
  'co_label',
  'co_price',
  'bulk_threshold_kg',
  'bulk_discount_percent',
  'no_analysis_label',
  'contact_services',
];

// Phải trùng các option của #contact-service trong contact.html — có test giữ
// hai nơi khớp nhau. CMS cần bản này để chốt tên Nhu cầu khi quản trị chưa lưu
// danh sách riêng.
const DEFAULT_CONTACT_SERVICES = [
  { code: 'cung-cap-mau', label: 'Cung cấp mẫu kim loại/quặng' },
  { code: 'phan-tich-lab', label: 'Phân tích & kiểm định' },
  { code: 'khao-sat-mo', label: 'Khảo sát mỏ' },
  { code: 'tuyen-khoang', label: 'Tuyển khoáng' },
];

// Mã nằm trong thuộc tính value của <option> và trong dữ liệu khách gửi, nên chỉ
// nhận chữ thường không dấu, số và gạch ngang.
const CODE_PATTERN = /^[a-z0-9-]{1,60}$/;
const NAME_MAX = 150;

function cleanString(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function cleanCode(value) {
  const code = typeof value === 'string' ? value.trim() : '';
  return CODE_PATTERN.test(code) ? code : null;
}

// Nhận cả số dạng chữ ("500000") vì ô số của form có thể gửi chuỗi.
function cleanNumber(value, { min, max = Infinity, integer = false }) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return null;
  if (integer && !Number.isInteger(number)) return null;
  if (number < min || number > max) return null;
  return number;
}

// Dòng hỏng bị bỏ thay vì làm hỏng cả danh sách; mã trùng thì giữ dòng đầu để
// option trên website không mang hai giá cho cùng một mã.
function cleanList(raw, nameKey, withPrice) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const code = cleanCode(item.code);
    const name = cleanString(item[nameKey], NAME_MAX);
    if (!code || !name || seen.has(code)) continue;
    const row = { code, [nameKey]: name };
    if (withPrice) {
      const price = cleanNumber(item.price, { min: 0, integer: true });
      if (price === null) continue;
      row.price = price;
    }
    seen.add(code);
    out.push(row);
  }
  return out;
}

const CLEANERS = {
  packaging: (value) => cleanList(value, 'name', true),
  co_label: (value) => cleanString(value, 150),
  co_price: (value) => cleanNumber(value, { min: 0, integer: true }),
  bulk_threshold_kg: (value) => cleanNumber(value, { min: 1, integer: true }),
  bulk_discount_percent: (value) => cleanNumber(value, { min: 0, max: 100 }),
  no_analysis_label: (value) => cleanString(value, 100),
  contact_services: (value) => cleanList(value, 'label', false),
};

// Chỉ lọc trường có mặt trong lượt ghi: lượt ghi một phần không được tự sinh
// các trường còn lại và xoá trắng chúng.
function sanitizeFormConfig(data) {
  const out = {};
  for (const key of FORM_CONFIG_FIELDS) {
    if (data && Object.hasOwn(data, key)) out[key] = CLEANERS[key](data[key]);
  }
  return out;
}

// Chốt mã và tên Nhu cầu lúc khách gửi form. Mã đúng mẫu nhưng không còn trong
// danh sách (khách mở trang từ trước khi quản trị sửa) vẫn giữ nguyên mã.
function resolveContactService(code, services) {
  const configured = cleanList(services, 'label', false);
  const list = configured.length ? configured : DEFAULT_CONTACT_SERVICES;
  const chosen = cleanCode(code) || list[0].code;
  const match = list.find((item) => item.code === chosen);
  return { service: chosen, service_label: match ? match.label : chosen };
}

module.exports = {
  FORM_CONFIG_FIELDS,
  DEFAULT_CONTACT_SERVICES,
  sanitizeFormConfig,
  resolveContactService,
};
