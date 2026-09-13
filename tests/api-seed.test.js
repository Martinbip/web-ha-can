'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { buildSeedDocuments, stableId } = require('../dha-api/scripts/lib/seed-docs');
const { toNdjson } = require('../dha-api/scripts/lib/ndjson');
const { TYPES } = require('../dha-api/src/sanity/types');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NOW = '2026-09-13T00:00:00.000Z';
const docs = buildSeedDocuments({ dataDir: DATA_DIR, now: NOW });
const byType = (type) => docs.filter((doc) => doc._type === type);
const readData = (file) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));

test('seed đủ mọi loại nội dung mà seed cũ của Strapi dựng', () => {
  const expected = {
    pricingPackage: readData('pricing_packages.json').length,
    pricingAnalysis: readData('pricing_analysis.json').length,
    pricingSurvey: readData('pricing_survey.json').length,
    project: readData('projects.json').length,
    product: readData('products.json').length,
    news: readData('news.json').length,
    heroSlide: readData('hero_slides.json').length,
    service: readData('services.json').length,
    workflowStep: readData('workflow_steps.json').length,
    ore: readData('products.json').length,
    productCategory: 3,
    siteSetting: 1,
    navigation: 1,
  };
  for (const [type, count] of Object.entries(expected)) {
    assert.equal(byType(type).length, count, type);
  }
});

test('mọi document hợp lệ: type đã khai báo, id duy nhất, không có nháp, có mốc thời gian', () => {
  const ids = new Set();
  for (const doc of docs) {
    assert.ok(TYPES[doc._type], doc._type);
    assert.ok(!ids.has(doc._id), `trùng id ${doc._id}`);
    ids.add(doc._id);
    assert.ok(!doc._id.startsWith('drafts.'));
    assert.equal(doc.createdAt, NOW);
    assert.equal(doc.publishedAt, NOW);
  }
});

test('id cố định giữa các lần chạy để import --replace chạy lại được', () => {
  const again = buildSeedDocuments({ dataDir: DATA_DIR, now: NOW });
  assert.deepEqual(again.map((doc) => doc._id), docs.map((doc) => doc._id));
  assert.match(stableId('news', 'a'), /^[a-f0-9]{24}$/);
  assert.notEqual(stableId('product', '0'), stableId('ore', '0'), 'cùng file nguồn nhưng khác type thì khác id');
});

test('singleton dùng id cố định; menu và danh mục lấy từ code', () => {
  assert.equal(byType('siteSetting')[0]._id, 'siteSetting');
  assert.equal(byType('navigation')[0]._id, 'navigation');
  assert.equal(byType('navigation')[0].items.length, 8);
  assert.deepEqual(byType('productCategory').map((doc) => doc.slug), ['color-metal', 'black-metal', 'rare-earth']);
});

test('sản phẩm luôn có mảng danh mục; quặng được xếp nhóm và có giá như seed cũ', () => {
  // guessCategories có thể trả [] (vd. uid lạ) — seed cũ cũng vậy; chỉ đòi là mảng.
  for (const product of byType('product')) {
    assert.ok(Array.isArray(product.categories), product.uid);
  }
  for (const ore of byType('ore')) {
    assert.ok(['black-metal', 'rare-earth', 'color-metal'].includes(ore.group), ore.uid);
    assert.ok(ore.price > 0, ore.uid);
  }
  const iron = byType('ore').find((ore) => (ore.uid || '').includes('sat'));
  if (iron) assert.equal(iron.group, 'black-metal');
});

test('NDJSON: mỗi dòng một document JSON', () => {
  const lines = toNdjson(docs).trimEnd().split('\n');
  assert.equal(lines.length, docs.length);
  assert.deepEqual(JSON.parse(lines[0]), docs[0]);
});
