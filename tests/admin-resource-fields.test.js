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
