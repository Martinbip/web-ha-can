const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const {
  listResourceConfigs,
} = require('../dha-cms/src/api/admin-ui/services/resource-config');

function readSchema(uid) {
  // uid dạng api::project.project → dha-cms/src/api/project/content-types/project
  const [, name] = uid.split('::');
  const [api, singular] = name.split('.');
  const file = path.join(root, 'dha-cms/src/api', api, 'content-types', singular, 'schema.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const BUILT_IN_FIELDS = ['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt'];

// Document Service từ chối cả truy vấn lẫn ghi khi `fields` chứa một quan hệ
// media, và trả 400 "Invalid key <tên trường>" — trang danh sách trắng luôn.
// Mọi trường admin đọc/ghi phải là thuộc tính vô hướng có thật trong schema.
test('mọi trường admin đọc/ghi đều tồn tại trong schema và không phải media', () => {
  for (const config of listResourceConfigs()) {
    const schema = readSchema(config.uid);
    const declared = [
      config.titleField,
      ...(config.listFields || []),
      ...(config.editableFields || []),
      ...(config.readFields || []),
      ...(config.searchableFields || []),
      ...Object.keys(config.fields || {}),
    ].filter((field) => field && !BUILT_IN_FIELDS.includes(field));

    for (const field of new Set(declared)) {
      const attribute = schema.attributes[field];
      assert.ok(attribute, `${config.type}.${field} không có trong schema ${config.uid}`);
      assert.notEqual(
        attribute.type,
        'media',
        `${config.type}.${field} là trường media — Document Service sẽ trả 400 "Invalid key ${field}"`,
      );
    }
  }
});

// Form quản trị và Strapi phải nói cùng một ngôn ngữ: mọi trường mà giao diện
// admin dựng ra đều phải có thật trong schema và nằm trong danh sách được ghi,
// nếu không thì bấm Lưu sẽ âm thầm mất dữ liệu (hoặc Strapi trả 400).
test('trường trong giao diện admin đều tồn tại trong schema và được phép ghi', () => {
  const source = fs.readFileSync(path.join(root, 'admin/src/config/resources.js'), 'utf8');

  for (const config of listResourceConfigs()) {
    const uiFields = readUiFields(source, config.type);
    if (!uiFields.length) continue;

    const schema = readSchema(config.uid);
    const writable = new Set(config.editableFields || []);
    const readOnly = new Set([...(config.readFields || []), ...BUILT_IN_FIELDS]);

    for (const field of uiFields) {
      assert.ok(
        schema.attributes[field],
        `${config.type}.${field} có trong form admin nhưng không có trong schema ${config.uid}`,
      );
      assert.ok(
        writable.has(field) || readOnly.has(field),
        `${config.type}.${field} hiện trong form admin nhưng backend không cho ghi`,
      );
    }
  }
});

// Đọc danh sách trường của một module trong cấu hình giao diện admin (file ESM,
// không require được từ test CommonJS nên cắt theo văn bản).
function readUiFields(source, type) {
  const start = source.indexOf(`'${type}': {`);
  if (start === -1) return [];
  const fieldsStart = source.indexOf('fields: {', start);
  if (fieldsStart === -1) return [];

  let depth = 0;
  let end = fieldsStart;
  for (let i = source.indexOf('{', fieldsStart); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  // Bắt cả cấu hình viết nhiều dòng lẫn viết gọn một dòng: tên trường là khóa
  // đứng ngay trước một object con.
  const block = source.slice(fieldsStart + 'fields: {'.length, end);
  return [...block.matchAll(/(?:^|[{,])\s*(\w+):\s*\{/gm)].map((match) => match[1]);
}
