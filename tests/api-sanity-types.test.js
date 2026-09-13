'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { TYPES, getTypeOptions } = require('../dha-api/src/sanity/types');
const { listResourceConfigs } = require('../dha-api/src/services/resource-config');

const SCHEMA_DIR = path.join(__dirname, '..', 'dha-api', 'src', 'schemas');

test('cờ nháp và singleton khớp với schema Strapi đã chép sang', () => {
  const files = fs.readdirSync(SCHEMA_DIR).filter((name) => name.endsWith('.json'));
  assert.equal(files.length, 15);
  for (const file of files) {
    const type = path.basename(file, '.json');
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8'));
    const options = getTypeOptions(type);
    assert.equal(options.drafts, Boolean(schema.options && schema.options.draftAndPublish), `${type}.drafts`);
    assert.equal(Boolean(options.singletonId), schema.kind === 'singleType', `${type} singleton`);
  }
});

test('mọi module admin đều có trong bảng type', () => {
  for (const config of listResourceConfigs()) {
    assert.ok(TYPES[config.sanityType], `${config.type} → ${config.sanityType}`);
  }
});

test('adminUser dùng id có dấu chấm, type lạ bị từ chối', () => {
  assert.equal(getTypeOptions('adminUser').idPrefix, 'adminUser.');
  assert.throws(() => getTypeOptions('user'), /không được khai báo/);
  assert.throws(() => getTypeOptions('__proto__'), /không được khai báo/);
});
