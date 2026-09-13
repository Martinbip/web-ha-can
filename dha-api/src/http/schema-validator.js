'use strict';

// Validate body của form công khai theo schema.json của Strapi đã chép sang
// dha-api/src/schemas — cùng ràng buộc Strapi đang áp dụng, không viết lại lần
// hai ở chỗ khác.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEXT_TYPES = new Set(['string', 'text', 'email']);
const NUMBER_TYPES = new Set(['decimal', 'float', 'integer']);

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function checkText(name, definition, value) {
  if (typeof value !== 'string') return { error: `${name} phải là chuỗi.` };
  if (definition.minLength !== undefined && value.length < definition.minLength) {
    return { error: `${name} phải có ít nhất ${definition.minLength} ký tự.` };
  }
  if (definition.maxLength !== undefined && value.length > definition.maxLength) {
    return { error: `${name} không được quá ${definition.maxLength} ký tự.` };
  }
  if (definition.regex && !new RegExp(definition.regex).test(value)) {
    return { error: `${name} không đúng định dạng.` };
  }
  if (definition.type === 'email' && !EMAIL.test(value)) {
    return { error: `${name} không phải email hợp lệ.` };
  }
  return { value };
}

function checkNumber(name, definition, value) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return { error: `${name} phải là số.` };
  if (definition.type === 'integer' && !Number.isInteger(number)) return { error: `${name} phải là số nguyên.` };
  if (definition.min !== undefined && number < definition.min) return { error: `${name} phải từ ${definition.min} trở lên.` };
  if (definition.max !== undefined && number > definition.max) return { error: `${name} không được quá ${definition.max}.` };
  return { value: number };
}

function checkAttribute(name, definition, value) {
  if (TEXT_TYPES.has(definition.type)) return checkText(name, definition, value);
  if (NUMBER_TYPES.has(definition.type)) return checkNumber(name, definition, value);
  if (definition.type === 'enumeration') {
    return definition.enum.includes(value) ? { value } : { error: `${name} không nằm trong danh sách cho phép.` };
  }
  if (definition.type === 'boolean') {
    return typeof value === 'boolean' ? { value } : { error: `${name} phải là true/false.` };
  }
  throw new Error(`schema-validator chưa hỗ trợ kiểu ${definition.type} (trường ${name})`);
}

// `forced`: trường do server quyết định (vd. status = 'new'), bỏ qua giá trị khách gửi.
function validateAgainstSchema(schema, input, { forced = {} } = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const data = {};
  const errors = [];

  for (const [name, definition] of Object.entries(schema.attributes)) {
    if (Object.prototype.hasOwnProperty.call(forced, name)) {
      data[name] = forced[name];
      continue;
    }
    const raw = source[name];
    if (isBlank(raw)) {
      if (definition.required) errors.push(`${name} là bắt buộc.`);
      else if (definition.default !== undefined) data[name] = definition.default;
      continue;
    }
    const result = checkAttribute(name, definition, raw);
    if (result.error) errors.push(result.error);
    else data[name] = result.value;
  }

  return { data, errors };
}

module.exports = { validateAgainstSchema };
