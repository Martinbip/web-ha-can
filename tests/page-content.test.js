// "Nội dung trang" giữ chữ của 7 trang dưới dạng JSON. Dữ liệu tới từ form admin
// nên phải lọc trước khi lưu: trang lạ, khoá lạ, sai kiểu, chữ quá dài.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const {
  PAGE_CODES,
  PAGE_FIELDS,
  SEO_FIELDS,
  sanitizePageContent,
} = require('../dha-cms/src/api/page-content/fields');
const { getResourceConfig } = require('../dha-cms/src/api/admin-ui/services/resource-config');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('nội dung trang là single type thật, hai trường JSON', () => {
  const schema = JSON.parse(read('dha-cms/src/api/page-content/content-types/page-content/schema.json'));
  assert.equal(schema.kind, 'singleType');
  assert.equal(schema.attributes.texts.type, 'json');
  assert.equal(schema.attributes.seo.type, 'json');
});

test('bảy trang, mỗi trang có khoá và giới hạn độ dài', () => {
  assert.deepEqual(PAGE_CODES, ['home', 'products', 'projects', 'news', 'pricing', 'estimator', 'contact']);
  for (const page of PAGE_CODES) {
    const fields = PAGE_FIELDS[page];
    assert.ok(fields && Object.keys(fields).length, `${page} phải có ô`);
    for (const [key, field] of Object.entries(fields)) {
      assert.ok(['text', 'textarea', 'url', 'text-list'].includes(field.type), `${page}.${key} sai kiểu`);
      assert.ok(field.max > 0, `${page}.${key} thiếu độ dài tối đa`);
    }
  }
  assert.deepEqual(Object.keys(SEO_FIELDS), ['title', 'description', 'image', 'image_alt']);
  assert.equal(SEO_FIELDS.title.max, 70);
  assert.equal(SEO_FIELDS.description.max, 200);
});

test('lọc dữ liệu trước khi lưu: bỏ trang lạ, khoá lạ, sai kiểu, cắt chữ quá dài', () => {
  const clean = sanitizePageContent({
    texts: {
      home: { services_title: '  Dịch vụ  ', khoa_la: 'x', services_description: 123 },
      trang_la: { a: 'b' },
      contact: { commitments: ['  Dòng 1  ', '', 42, 'Dòng 2'] },
    },
    seo: {
      home: { title: 'T'.repeat(100), description: 'Mô tả', anh_la: 'x' },
      trang_la: { title: 'x' },
    },
  });

  assert.deepEqual(clean.texts.home, { services_title: 'Dịch vụ' }, 'bỏ khoá lạ và giá trị sai kiểu, cắt khoảng trắng');
  assert.equal(clean.texts.trang_la, undefined);
  assert.deepEqual(clean.texts.contact.commitments, ['Dòng 1', 'Dòng 2'], 'danh sách chỉ giữ dòng chữ có nội dung');
  assert.equal(clean.seo.home.title.length, 70, 'tiêu đề SEO bị cắt theo giới hạn');
  assert.equal(clean.seo.home.anh_la, undefined);
  assert.equal(clean.seo.trang_la, undefined);
});

test('lưu nội dung trang thì ghi lại HTML tĩnh ngay', () => {
  const prerender = require('../dha-cms/src/api/site-setting/prerender');
  const original = prerender.schedulePrerender;
  let calls = 0;
  prerender.schedulePrerender = () => {
    calls += 1;
  };
  try {
    const lifecycles = require('../dha-cms/src/api/page-content/content-types/page-content/lifecycles');
    const createEvent = { params: { data: { texts: { home: { services_title: 'A' } } } } };
    lifecycles.beforeCreate(createEvent);
    assert.deepEqual(createEvent.params.data.texts.home, { services_title: 'A' }, 'lọc ngay trước khi lưu');
    lifecycles.afterCreate();
    lifecycles.afterUpdate();
    assert.equal(calls, 2);
  } finally {
    prerender.schedulePrerender = original;
  }
});

test('website đọc được nội dung trang mà không cần đăng nhập, admin sửa được', () => {
  assert.match(read('dha-cms/src/index.js'), /api::page-content\.page-content\.find'/);
  const config = getResourceConfig('page-content');
  assert.equal(config.uid, 'api::page-content.page-content');
  assert.equal(config.singleType, true);
  assert.deepEqual(config.editableFields, ['texts', 'seo']);
});

test('danh sách ô của admin khớp khai báo phía CMS', () => {
  const source = read('admin/src/config/page-content-fields.js');
  for (const page of PAGE_CODES) {
    const block = source.match(new RegExp(`code: '${page}'[\\s\\S]*?\\n  \\},`));
    assert.ok(block, `admin thiếu tab ${page}`);
    const keys = [...block[0].matchAll(/key: '([a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(keys, Object.keys(PAGE_FIELDS[page]).sort(), `tab ${page} lệch khoá so với CMS`);
  }
  for (const key of Object.keys(SEO_FIELDS)) {
    assert.match(source, new RegExp(`key: '${key}'`), `admin thiếu ô SEO ${key}`);
  }
});
