'use strict';

// Quét trường hợp biên của hai màn hình dễ nhập bậy nhất: menu điều hướng và
// thư viện ảnh.
process.env.ADMIN_UI_SESSION_SECRET = 'test-secret-admin-ui';

const assert = require('node:assert/strict');
const test = require('node:test');

const navigation = require('../dha-cms/src/api/admin-ui/services/navigation');
const media = require('../dha-cms/src/api/admin-ui/services/media');
const { buildCtx, createFakeStrapi } = require('./helpers/admin-ui-harness');

const NAV_UID = 'api::navigation.navigation';

test.beforeEach(() => {
  global.strapi = undefined;
});

// --- menu: kiểm tra dữ liệu -------------------------------------------------

test('menu từ chối đường dẫn nguy hiểm thay vì ghi thẳng ra website', () => {
  const dangerous = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://vi-du.vn',
    'vi-du.vn',
    'http://',
    'https://',
  ];
  for (const url of dangerous) {
    assert.equal(navigation.normalizeUrl(url), null, `phải từ chối: ${url}`);
  }
});

test('menu chấp nhận đường dẫn nội bộ và liên kết http(s) đầy đủ', () => {
  assert.equal(navigation.normalizeUrl('/products'), '/products');
  assert.equal(navigation.normalizeUrl('  /products  '), '/products');
  assert.equal(navigation.normalizeUrl('#lien-he'), '#lien-he');
  assert.equal(navigation.normalizeUrl('https://dhacan.vn/tin-tuc'), 'https://dhacan.vn/tin-tuc');
});

test('menu không nhận liên kết ngoài trá hình đường dẫn nội bộ', () => {
  // "//ke-tan-cong.example" trông như đường dẫn trong website nhưng trình duyệt
  // hiểu là http(s)://ke-tan-cong.example — khách bấm menu là rời khỏi website.
  assert.equal(navigation.normalizeUrl('//ke-tan-cong.example'), null);
  assert.equal(navigation.normalizeUrl('/\\ke-tan-cong.example'), null);
});

test('menu chặn đường dẫn và nhãn dài bất thường', () => {
  assert.equal(navigation.normalizeUrl(`/${'a'.repeat(500)}`), null, 'đường dẫn quá 500 ký tự');

  const { errors } = navigation.normalizeTree([{ label: 'a'.repeat(101), url: '/x' }]);
  assert.match(errors[0], /100 ký tự/);
});

test('menu đòi tên hiển thị và đường dẫn cho từng mục, báo rõ mục nào sai', () => {
  const { items, errors } = navigation.normalizeTree([
    { label: '   ', url: '/a' },
    { label: 'Sản phẩm', url: '' },
    { label: 'Tin tức', url: '/tin-tuc' },
  ]);
  assert.equal(items.length, 1);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /Mục 1/);
  assert.match(errors[1], /Mục 2/);
});

test('menu chặn số lượng mục vượt ngưỡng', () => {
  const many = Array.from({ length: 21 }, (_, i) => ({ label: `Mục ${i}`, url: '/x' }));
  assert.match(navigation.normalizeTree(many).errors[0], /tối đa 20 mục cấp 1/);

  const manyChildren = [
    {
      label: 'Cha',
      url: '/x',
      children: Array.from({ length: 21 }, (_, i) => ({ label: `Con ${i}`, url: '/y' })),
    },
  ];
  assert.match(navigation.normalizeTree(manyChildren).errors[0], /tối đa 20 mục con/);
});

test('menu chỉ sâu 2 cấp: cháu bị bỏ chứ không làm hỏng cây', () => {
  const { items, errors } = navigation.normalizeTree([
    {
      label: 'Sản phẩm',
      url: '/products',
      children: [{ label: 'Đồng', url: '/products/dong', children: [{ label: 'Cháu', url: '/x' }] }],
    },
  ]);
  assert.equal(errors.length, 0);
  assert.equal(items[0].children.length, 1);
  assert.deepEqual(items[0].children[0].children, []);
});

test('id trùng nhau được tách ra để menu không nhảy nhầm mục', () => {
  const { items } = navigation.normalizeTree([
    { id: 'tin-tuc', label: 'Tin tức', url: '/news' },
    { id: 'tin-tuc', label: 'Tin tức cũ', url: '/news-old' },
    { label: 'Tin tức', url: '/news-2' },
  ]);
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `id phải khác nhau: ${ids}`);
});

test('id do người dùng gõ được lọc sạch ký tự lạ', () => {
  const { items } = navigation.normalizeTree([{ id: '<script>x</script>', label: 'A', url: '/a' }]);
  assert.match(items[0].id, /^[a-z0-9-]+$/);
});

test('mục không có id thì sinh id từ nhãn tiếng Việt, nhãn toàn ký tự lạ vẫn có id', () => {
  const { items } = navigation.normalizeTree([
    { label: 'Dịch vụ & Đối tác', url: '/dich-vu' },
    { label: '!!!', url: '/x' },
  ]);
  assert.equal(items[0].id, 'dich-vu-doi-tac');
  assert.match(items[1].id, /^muc-2|^[a-z0-9-]+$/);
});

test('menu rỗng hoặc dữ liệu không phải danh sách đều bị từ chối', () => {
  assert.match(navigation.normalizeTree([]).errors[0], /ít nhất một mục/);
  for (const input of [null, undefined, {}, 'menu', 42]) {
    assert.match(navigation.normalizeTree(input).errors[0], /không hợp lệ/, `input ${JSON.stringify(input)}`);
  }
});

test('trạng thái ẩn/hiện giữ nguyên, mặc định là hiện', () => {
  const { items } = navigation.normalizeTree([
    { label: 'A', url: '/a' },
    { label: 'B', url: '/b', visible: false },
    { label: 'C', url: '/c', visible: 'khong-phai-boolean' },
  ]);
  assert.deepEqual(items.map((item) => item.visible), [true, false, true]);
});

// --- menu: endpoint ----------------------------------------------------------

test('menu chưa có bản ghi thì trả menu mặc định để còn sửa được', async () => {
  global.strapi = createFakeStrapi({ [NAV_UID]: [] });
  const ctx = buildCtx({});
  await navigation.get(ctx);
  assert.ok(Array.isArray(ctx.body.data.items));
  assert.ok(ctx.body.data.items.length > 0);
});

test('chưa đăng nhập thì không đọc và không ghi được menu', async () => {
  const fake = createFakeStrapi({ [NAV_UID]: [] });
  global.strapi = fake;

  const read = buildCtx({ cookie: null });
  await navigation.get(read);
  assert.equal(read.status, 401);

  const write = buildCtx({ cookie: null, body: { data: { items: [{ label: 'A', url: '/a' }] } } });
  await navigation.update(write);
  assert.equal(write.status, 401);
  assert.ok(!fake.__calls.some((call) => ['create', 'update'].includes(call.method)));
});

test('lưu menu từ trang lạ bị chặn như mọi thao tác ghi khác', async () => {
  const fake = createFakeStrapi({ [NAV_UID]: [] });
  global.strapi = fake;
  const ctx = buildCtx({ origin: 'https://ke-tan-cong.example', body: { data: { items: [{ label: 'A', url: '/a' }] } } });
  await navigation.update(ctx);
  assert.equal(ctx.status, 403, 'menu cũng phải kiểm tra nguồn yêu cầu');
  assert.ok(!fake.__calls.some((call) => ['create', 'update'].includes(call.method)));
});

test('menu sai dữ liệu trả lỗi 400 kèm danh sách lỗi, không ghi gì vào CSDL', async () => {
  const fake = createFakeStrapi({ [NAV_UID]: [{ documentId: 'nav-1', items: [{ id: 'a', label: 'A', url: '/a' }] }] });
  global.strapi = fake;
  const ctx = buildCtx({ body: { data: { items: [{ label: '', url: 'javascript:alert(1)' }] } } });
  await navigation.update(ctx);
  assert.equal(ctx.status, 400);
  assert.equal(ctx.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(ctx.body.error.details));
  assert.ok(!fake.__calls.some((call) => call.method === 'update'));
});

test('lưu menu hợp lệ ghi đè đúng bản ghi đang có', async () => {
  const fake = createFakeStrapi({ [NAV_UID]: [{ documentId: 'nav-1', items: [{ id: 'a', label: 'A', url: '/a' }] }] });
  global.strapi = fake;
  const ctx = buildCtx({ body: { data: { items: [{ label: 'Sản phẩm', url: '/products' }] } } });
  await navigation.update(ctx);
  assert.equal(ctx.status, 200);
  const update = fake.__calls.find((call) => call.method === 'update');
  assert.equal(update.documentId, 'nav-1');
  assert.equal(fake.__rows(NAV_UID).length, 1);
});

// --- thư viện ảnh ------------------------------------------------------------

test('thư mục ảnh không thoát ra ngoài vùng của website', () => {
  const cases = [
    ['dha/news', 'dha/news'],
    ['dha/news/', 'dha/news/'],
    ['ha-can/hero', 'ha-can/hero'],
    ['dha//news', 'dha/news'],
    ['dha/./news', 'dha/news'],
    ['dha/../../etc', 'dha/etc'],
    ['../../etc/passwd', 'dha/'],
    ['/etc/passwd', 'dha/'],
    ['khac/news', 'dha/'],
    ['', 'dha/'],
    [null, 'dha/'],
    [undefined, 'dha/'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(media.getScopedPrefix(input), expected, `prefix ${JSON.stringify(input)}`);
  }
});

test('ảnh tải lên bị chặn theo dung lượng, định dạng và phần mở rộng', () => {
  const ok = (file) => media.validateUploadFile(file).ok;

  assert.equal(ok({ size: 1024, mimetype: 'image/png', originalFilename: 'a.png' }), true);
  assert.equal(ok({ size: 5 * 1024 * 1024, mimetype: 'image/jpeg', originalFilename: 'a.JPG' }), true, 'đuôi viết hoa vẫn nhận');

  const tooBig = media.validateUploadFile({ size: 5 * 1024 * 1024 + 1, mimetype: 'image/png', originalFilename: 'a.png' });
  assert.equal(tooBig.status, 413);

  const rejected = [
    { size: 0, mimetype: 'image/png', originalFilename: 'a.png' },
    { size: -1, mimetype: 'image/png', originalFilename: 'a.png' },
    { size: NaN, mimetype: 'image/png', originalFilename: 'a.png' },
    { size: 10, mimetype: 'image/svg+xml', originalFilename: 'a.svg' },
    { size: 10, mimetype: 'text/html', originalFilename: 'a.html' },
    { size: 10, mimetype: 'application/x-php', originalFilename: 'a.php' },
    { size: 10, mimetype: 'image/png', originalFilename: 'a.php' },
    { size: 10, mimetype: 'image/png', originalFilename: 'khong-co-duoi' },
    { size: 10, mimetype: 'image/png', originalFilename: 'a.png.php' },
    { size: 10, mimetype: '', originalFilename: 'a.png' },
  ];
  for (const file of rejected) {
    assert.equal(ok(file), false, `phải từ chối: ${JSON.stringify(file)}`);
  }
});

test('xoá ảnh ngoài vùng của website bị từ chối', async () => {
  global.strapi = createFakeStrapi({});
  for (const publicId of ['khac/anh', '../ha-can/hero/a', '', 'dha', 'ha-can']) {
    const ctx = buildCtx({ params: { publicId: encodeURIComponent(publicId) } });
    await media.delete(ctx);
    assert.equal(ctx.status, 400, `public_id ${publicId} phải bị từ chối`);
    assert.equal(ctx.body.error.code, 'INVALID_PUBLIC_ID');
  }
});

test('ảnh đang được nội dung nào đó dùng thì không cho xoá, và chỉ rõ chỗ dùng', async () => {
  global.strapi = createFakeStrapi({
    'api::news.news': [{ documentId: 'doc-a', title: 'Bài A', image: 'https://res.cloudinary.com/x/dha/news/anh-1.jpg' }],
    'api::project.project': [{ documentId: 'doc-b', name: 'Dự án B', cloudinary_public_id: 'dha/news/anh-1' }],
  });

  const references = await media.findReferences('dha/news/anh-1');
  assert.ok(references.length >= 2, 'tìm thấy cả ảnh gắn qua URL lẫn qua public_id');
  assert.ok(references.some((reference) => reference.title === 'Bài A'));

  const ctx = buildCtx({ params: { publicId: encodeURIComponent('dha/news/anh-1') } });
  await media.delete(ctx);
  assert.equal(ctx.status, 409);
  assert.equal(ctx.body.error.code, 'MEDIA_IN_USE');
  assert.ok(ctx.body.error.details.references.length > 0);
});

test('chưa đăng nhập thì không xem, không tải lên, không xoá được ảnh', async () => {
  global.strapi = createFakeStrapi({});
  for (const run of [media.list, media.upload, media.delete]) {
    const ctx = buildCtx({ cookie: null, params: { publicId: 'dha/news/anh-1' }, query: {} });
    await run(ctx);
    assert.equal(ctx.status, 401);
  }
});

test('tải lên từ trang lạ bị chặn trước khi đụng tới Cloudinary', async () => {
  global.strapi = createFakeStrapi({});
  const ctx = buildCtx({ origin: 'https://ke-tan-cong.example', body: {}, files: {} });
  await media.upload(ctx);
  assert.equal(ctx.status, 403);
  assert.equal(ctx.body.error.code, 'CSRF_ORIGIN');
});
