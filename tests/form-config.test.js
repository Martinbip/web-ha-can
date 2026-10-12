// "Dự toán & Liên hệ" giữ cấu hình hai form. Dữ liệu tới từ form admin và từ
// khách gửi form Liên hệ, nên phải lọc trước khi lưu.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const {
  FORM_CONFIG_FIELDS,
  DEFAULT_CONTACT_SERVICES,
  sanitizeFormConfig,
  resolveContactService,
} = require('../dha-cms/src/api/form-config/fields');
const { getResourceConfig } = require('../dha-cms/src/api/admin-ui/services/resource-config');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('cấu hình hai form là single type thật, đủ các trường', () => {
  const schema = JSON.parse(read('dha-cms/src/api/form-config/content-types/form-config/schema.json'));
  assert.equal(schema.kind, 'singleType');
  assert.deepEqual(Object.keys(schema.attributes), FORM_CONFIG_FIELDS);
  assert.equal(schema.attributes.packaging.type, 'json');
  assert.equal(schema.attributes.contact_services.type, 'json');
  assert.equal(schema.attributes.co_price.type, 'integer');
});

test('danh sách đóng gói: bỏ dòng hỏng, mã trùng giữ dòng đầu, cắt tên dài', () => {
  const clean = sanitizeFormConfig({
    packaging: [
      { code: ' hop ', name: '  Hộp kín  ', price: 150000 },
      { code: 'hop', name: 'Trùng mã', price: 1 },
      { code: 'Có Dấu', name: 'Mã sai mẫu', price: 1 },
      { code: 'bao', name: '', price: 1 },
      { code: 'am', name: 'Giá âm', price: -5 },
      { code: 'le', name: 'Giá lẻ', price: 1.5 },
      { code: 'chuoi', name: 'Giá dạng chữ', price: '250000' },
      { code: 'dai', name: 'x'.repeat(300), price: 0 },
      'rác',
      null,
    ],
  });
  assert.deepEqual(clean.packaging, [
    { code: 'hop', name: 'Hộp kín', price: 150000 },
    { code: 'chuoi', name: 'Giá dạng chữ', price: 250000 },
    { code: 'dai', name: 'x'.repeat(150), price: 0 },
  ]);
});

test('số sai kiểu hoặc ngoài khoảng thì lưu null, chữ rỗng thì lưu null', () => {
  const clean = sanitizeFormConfig({
    co_price: -1,
    bulk_threshold_kg: 0,
    bulk_discount_percent: 120,
    co_label: '   ',
    no_analysis_label: '  Chỉ lấy mẫu  ',
  });
  assert.equal(clean.co_price, null);
  assert.equal(clean.bulk_threshold_kg, null);
  assert.equal(clean.bulk_discount_percent, null);
  assert.equal(clean.co_label, null);
  assert.equal(clean.no_analysis_label, 'Chỉ lấy mẫu');

  const ok = sanitizeFormConfig({ co_price: '500000', bulk_threshold_kg: 500, bulk_discount_percent: 2.5 });
  assert.deepEqual(ok, { co_price: 500000, bulk_threshold_kg: 500, bulk_discount_percent: 2.5 });
});

test('lượt ghi chỉ gửi một trường thì không tự sinh các trường còn lại', () => {
  assert.deepEqual(sanitizeFormConfig({ co_label: 'CO' }), { co_label: 'CO' });
  assert.deepEqual(sanitizeFormConfig({ contact_services: 'rác' }), { contact_services: [] });
});

test('danh sách Nhu cầu: mã hợp lệ, bỏ dòng thiếu tên', () => {
  const clean = sanitizeFormConfig({
    contact_services: [{ code: 'tu-van', label: ' Tư vấn ' }, { code: 'x', label: '' }, { code: '', label: 'Thiếu mã' }],
  });
  assert.deepEqual(clean.contact_services, [{ code: 'tu-van', label: 'Tư vấn' }]);
});

test('khách gửi mã Nhu cầu: tra tên theo cấu hình, mã lạ về mục đầu', () => {
  const services = [{ code: 'tu-van', label: 'Tư vấn' }, { code: 'mua-mau', label: 'Mua mẫu' }];
  assert.deepEqual(resolveContactService('mua-mau', services), { service: 'mua-mau', service_label: 'Mua mẫu' });
  assert.deepEqual(resolveContactService('<script>', services), { service: 'tu-van', service_label: 'Tư vấn' });
  assert.deepEqual(resolveContactService(undefined, services), { service: 'tu-van', service_label: 'Tư vấn' });
  // Mã đúng mẫu nhưng đã bị xoá khỏi danh sách (khách mở trang từ trước): giữ mã.
  assert.deepEqual(resolveContactService('da-xoa', services), { service: 'da-xoa', service_label: 'da-xoa' });
  // Cấu hình chưa có danh sách: dùng danh sách mặc định.
  assert.deepEqual(resolveContactService('khao-sat-mo', null), { service: 'khao-sat-mo', service_label: 'Khảo sát mỏ' });
  assert.deepEqual(resolveContactService('', []), { service: 'cung-cap-mau', service_label: 'Cung cấp mẫu kim loại/quặng' });
});

test('lưu yêu cầu liên hệ thì chốt tên Nhu cầu, bỏ tên do khách tự gửi', async () => {
  const lifecycles = require('../dha-cms/src/api/contact-inquiry/content-types/contact-inquiry/lifecycles');
  const original = global.strapi;
  global.strapi = {
    db: { query: () => ({ findOne: async () => ({ contact_services: [{ code: 'tu-van', label: 'Tư vấn' }] }) }) },
  };
  try {
    const event = { params: { data: { name: 'A', service: 'tu-van', service_label: 'Giả mạo' } } };
    await lifecycles.beforeCreate(event);
    assert.equal(event.params.data.service, 'tu-van');
    assert.equal(event.params.data.service_label, 'Tư vấn');

    global.strapi = { db: { query: () => ({ findOne: async () => { throw new Error('db lỗi'); } }) } };
    const fallback = { params: { data: { service: 'phan-tich-lab' } } };
    await lifecycles.beforeCreate(fallback);
    assert.equal(fallback.params.data.service_label, 'Phân tích & kiểm định', 'CSDL lỗi thì dùng danh sách mặc định');
  } finally {
    global.strapi = original;
  }
});

test('Nhu cầu không còn khoá bằng enum, có thêm tên chốt lúc gửi', () => {
  const schema = JSON.parse(read('dha-cms/src/api/contact-inquiry/content-types/contact-inquiry/schema.json'));
  assert.equal(schema.attributes.service.type, 'string');
  assert.equal(schema.attributes.service_label.type, 'string');
  assert.equal(getResourceConfig('contact-inquiries').listFields.includes('service_label'), true);
});

test('lưu cấu hình thì lọc dữ liệu và ghi lại HTML tĩnh ngay', () => {
  const prerender = require('../dha-cms/src/api/site-setting/prerender');
  const original = prerender.schedulePrerender;
  let calls = 0;
  prerender.schedulePrerender = () => {
    calls += 1;
  };
  try {
    const lifecycles = require('../dha-cms/src/api/form-config/content-types/form-config/lifecycles');
    const event = { params: { data: { co_price: -1, co_label: ' CO ' } } };
    lifecycles.beforeUpdate(event);
    assert.deepEqual(event.params.data, { co_price: null, co_label: 'CO' });
    lifecycles.afterCreate();
    lifecycles.afterUpdate();
    assert.equal(calls, 2);
  } finally {
    prerender.schedulePrerender = original;
  }
});

test('website đọc được cấu hình mà không cần đăng nhập, admin sửa được', () => {
  assert.match(read('dha-cms/src/index.js'), /api::form-config\.form-config\.find'/);
  const config = getResourceConfig('form-config');
  assert.equal(config.uid, 'api::form-config.form-config');
  assert.equal(config.singleType, true);
  assert.deepEqual(config.editableFields, FORM_CONFIG_FIELDS);
});

test('danh sách Nhu cầu mặc định khớp contact.html', () => {
  const html = read('contact.html');
  const select = html.match(/<select id="contact-service"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(select, 'contact.html phải có ô Nhu cầu');
  const options = [...select[1].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)]
    .map((m) => ({ code: m[1], label: m[2].replace(/&amp;/g, '&') }));
  assert.deepEqual(options, DEFAULT_CONTACT_SERVICES);
});

test('admin có trang "Dự toán & Liên hệ" với đúng các ô của CMS', () => {
  const source = read('admin/src/config/resources.js');
  const start = source.indexOf("'form-config': {");
  assert.ok(start > -1, 'admin thiếu cấu hình form-config');
  const block = source.slice(start, source.indexOf("\n  },\n", start));
  for (const key of FORM_CONFIG_FIELDS) {
    assert.match(block, new RegExp(`\\n      ${key}: \\{`), `admin thiếu ô ${key}`);
  }
  assert.match(read('admin/src/App.jsx'), /path="\/form-config" element={<FormConfigPage \/>}/);
  assert.match(read('admin/src/layout/AdminShell.jsx'), /\['\/form-config', 'Dự toán & Liên hệ'/);
  assert.match(read('admin/src/tour/tourSteps.js'), /\[\/\^\\\/form-config\$\/, 'form-config'\]/);
  const page = read('admin/src/pages/FormConfigPage.jsx');
  for (const key of FORM_CONFIG_FIELDS) {
    assert.match(page, new RegExp(`'${key}'`), `trang chưa dựng ô ${key}`);
  }
});

test('admin hiện tên Nhu cầu đã chốt, và nhắc đơn vị kg ở ô giá sản phẩm', () => {
  const source = read('admin/src/config/resources.js');
  assert.match(source, /'contact-inquiries': \{[^\n]*listFields: \['name', 'phone', 'service_label'/);
  assert.match(source, /service_label: \{ label: 'Nhu cầu', type: 'text', readOnly: true \}/);
  assert.match(source, /price_unit: \{[^\n]*Dự toán/);
});

// Dự toán ghi sẵn giá sản phẩm và biểu phí phân tích vào HTML, nên sửa hai mục
// này cũng phải ghi lại HTML ngay — không thì khách thấy giá cũ tới lần deploy sau.
for (const api of ['product', 'pricing-analysis']) {
  test(`lưu hoặc xoá ${api} thì ghi lại HTML tĩnh ngay`, () => {
    const prerender = require('../dha-cms/src/api/site-setting/prerender');
    const original = prerender.schedulePrerender;
    let calls = 0;
    prerender.schedulePrerender = () => {
      calls += 1;
    };
    try {
      const lifecycles = require(`../dha-cms/src/api/${api}/content-types/${api}/lifecycles`);
      lifecycles.afterCreate();
      lifecycles.afterUpdate();
      lifecycles.afterDelete();
      assert.equal(calls, 3);
    } finally {
      prerender.schedulePrerender = original;
    }
  });
}
