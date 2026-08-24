'use strict';

// Quét các trường hợp biên của lớp dữ liệu admin: phân trang, sắp xếp, tìm
// kiếm, whitelist trường, slug trùng, và quy tắc xuất bản sau khi lưu.
process.env.ADMIN_UI_SESSION_SECRET = 'test-secret-admin-ui';

const assert = require('node:assert/strict');
const test = require('node:test');

const resources = require('../dha-cms/src/api/admin-ui/services/resources');
const { buildCtx, createFakeStrapi } = require('./helpers/admin-ui-harness');

const NEWS = 'api::news.news';
const PRODUCTS = 'api::product.product';
const SETTINGS = 'api::site-setting.site-setting';
const ORDERS = 'api::order-request.order-request';

function useStrapi(seed) {
  const fake = createFakeStrapi(seed);
  global.strapi = fake;
  return fake;
}

test.beforeEach(() => {
  global.strapi = undefined;
});

// --- kiểm soát truy cập ------------------------------------------------------

test('module không có trong whitelist trả 404 thay vì đụng vào CSDL', async () => {
  useStrapi({});
  for (const type of ['admin::user', 'users-permissions', '../../etc', 'toString', 'constructor', '__proto__']) {
    const ctx = buildCtx({ params: { type } });
    await resources.list(ctx);
    assert.equal(ctx.status, 404, `type ${type} phải bị từ chối`);
    assert.equal(ctx.body.error.code, 'UNKNOWN_RESOURCE');
  }
});

test('chưa đăng nhập thì không đọc và không ghi được gì', async () => {
  const fake = useStrapi({ [NEWS]: [{ title: 'A', slug: 'a' }] });
  for (const [name, run] of [
    ['list', resources.list],
    ['get', resources.get],
    ['create', resources.create],
    ['update', resources.update],
    ['delete', resources.delete],
    ['publish', resources.publish],
    ['unpublish', resources.unpublish],
  ]) {
    const ctx = buildCtx({ params: { type: 'news', id: 'doc-1' }, cookie: null, body: { data: { title: 'X' } } });
    await run(ctx);
    assert.equal(ctx.status, 401, `${name} phải đòi đăng nhập`);
  }
  assert.equal(fake.__calls.filter((call) => ['create', 'update', 'delete', 'publish'].includes(call.method)).length, 0);
});

test('mọi thao tác ghi đều đòi nguồn yêu cầu hợp lệ', async () => {
  const fake = useStrapi({ [NEWS]: [{ title: 'A', slug: 'a' }] });
  for (const run of [resources.create, resources.update, resources.delete, resources.publish, resources.unpublish]) {
    const ctx = buildCtx({
      params: { type: 'news', id: 'doc-1' },
      origin: 'https://ke-tan-cong.example',
      body: { data: { title: 'X' } },
    });
    await run(ctx);
    assert.equal(ctx.status, 403);
    assert.equal(ctx.body.error.code, 'CSRF_ORIGIN');
  }
  assert.equal(fake.__calls.filter((call) => ['create', 'update', 'delete'].includes(call.method)).length, 0);
});

// --- phân trang, sắp xếp, tìm kiếm ------------------------------------------

test('phân trang chặn giá trị vô lý thay vì truy vấn cả bảng', async () => {
  const fake = useStrapi({ [PRODUCTS]: Array.from({ length: 5 }, (_, i) => ({ name: `SP ${i}`, uid: `sp-${i}` })) });

  const cases = [
    [{ page: '0', pageSize: '20' }, { start: 0, limit: 20 }],
    [{ page: '-3', pageSize: '20' }, { start: 0, limit: 20 }],
    [{ page: '2', pageSize: '9999' }, { start: 100, limit: 100 }],
    [{ page: 'abc', pageSize: 'xyz' }, { start: 0, limit: 20 }],
    [{ page: '1', pageSize: '0' }, { start: 0, limit: 1 }],
    [{ page: '1', pageSize: '2.9' }, { start: 0, limit: 2 }],
    [{ page: '1e400', pageSize: '20' }, { start: 0, limit: 20 }],
  ];

  for (const [query, expected] of cases) {
    fake.__calls.length = 0;
    const ctx = buildCtx({ params: { type: 'products' }, query });
    await resources.list(ctx);
    const call = fake.__calls.find((entry) => entry.method === 'findMany');
    assert.equal(call.limit, expected.limit, `pageSize cho ${JSON.stringify(query)}`);
    assert.equal(call.start, expected.start, `start cho ${JSON.stringify(query)}`);
  }
});

test('sắp xếp chỉ nhận trường được phép đọc, còn lại quay về mặc định', async () => {
  const fake = useStrapi({ [PRODUCTS]: [{ name: 'A', uid: 'a' }] });

  const cases = [
    ['name:desc', { name: 'desc' }],
    ['name:DESC', { name: 'desc' }],
    ['name:linh-tinh', { name: 'asc' }],
    ['name', { name: 'asc' }],
    ['password:desc', { sort_order: 'asc' }],
    ['createdBy.email:asc', { sort_order: 'asc' }],
    ['', { sort_order: 'asc' }],
  ];

  for (const [sort, expected] of cases) {
    fake.__calls.length = 0;
    const ctx = buildCtx({ params: { type: 'products' }, query: sort ? { sort } : {} });
    await resources.list(ctx);
    const call = fake.__calls.find((entry) => entry.method === 'findMany');
    assert.deepEqual(call.sort, expected, `sort=${sort}`);
  }
});

test('tìm kiếm chỉ dò các trường được khai báo và bỏ qua chuỗi trắng', async () => {
  const fake = useStrapi({ [PRODUCTS]: [{ name: 'Đồng tấm', uid: 'dong-tam' }] });

  const searching = buildCtx({ params: { type: 'products' }, query: { search: ' đồng ' } });
  await resources.list(searching);
  const withSearch = fake.__calls.find((entry) => entry.method === 'findMany');
  assert.deepEqual(
    withSearch.filters.$or.map((clause) => Object.keys(clause)[0]),
    ['name', 'uid', 'grade', 'origin'],
  );
  assert.equal(withSearch.filters.$or[0].name.$containsi, 'đồng');

  fake.__calls.length = 0;
  const blank = buildCtx({ params: { type: 'products' }, query: { search: '   ' } });
  await resources.list(blank);
  assert.deepEqual(fake.__calls.find((entry) => entry.method === 'findMany').filters, {});
});

test('lọc theo trạng thái chỉ áp dụng cho module thật sự có trường trạng thái', async () => {
  const fake = useStrapi({ [PRODUCTS]: [], [ORDERS]: [] });

  const products = buildCtx({ params: { type: 'products' }, query: { status: 'new' } });
  await resources.list(products);
  assert.deepEqual(fake.__calls.find((entry) => entry.method === 'findMany').filters, {});

  fake.__calls.length = 0;
  const orders = buildCtx({ params: { type: 'order-requests' }, query: { status: 'new' } });
  await resources.list(orders);
  assert.deepEqual(fake.__calls.find((entry) => entry.method === 'findMany').filters, { status: 'new' });
});

test('danh sách trả đúng tổng số bản ghi khớp bộ lọc, không phải số dòng của trang', async () => {
  useStrapi({ [PRODUCTS]: Array.from({ length: 25 }, (_, i) => ({ name: `SP ${i}`, uid: `sp-${i}` })) });
  const ctx = buildCtx({ params: { type: 'products' }, query: { page: '2', pageSize: '10' } });
  await resources.list(ctx);
  assert.equal(ctx.body.meta.total, 25);
  assert.equal(ctx.body.data.length, 10);
  assert.equal(ctx.body.meta.page, 2);
});

// --- whitelist trường --------------------------------------------------------

test('lưu bỏ qua mọi trường không nằm trong danh sách được sửa', async () => {
  const fake = useStrapi({ [NEWS]: [] });
  const ctx = buildCtx({
    params: { type: 'news' },
    body: {
      data: {
        title: 'Bài mới',
        slug: 'bai-moi',
        summary: 'tóm tắt',
        content: '<p>x</p>',
        category: 'gia-ca',
        date: '2026-01-01',
        id: 999,
        documentId: 'gia-mao',
        publishedAt: '2020-01-01T00:00:00.000Z',
        createdBy: 1,
        locale: 'en',
        __proto__: { polluted: true },
      },
    },
  });
  await resources.create(ctx);
  const created = fake.__calls.find((entry) => entry.method === 'create');
  assert.deepEqual(Object.keys(created.data).sort(), ['category', 'content', 'date', 'slug', 'summary', 'title']);
  assert.equal({}.polluted, undefined, 'không bị prototype pollution');
});

test('phản hồi chỉ chứa trường được phép đọc', async () => {
  useStrapi({
    [NEWS]: [
      {
        documentId: 'doc-x',
        title: 'A',
        slug: 'a',
        summary: 's',
        content: 'c',
        category: 'gia-ca',
        date: '2026-01-01',
        image: null,
        createdBy: { email: 'noi-bo@dha.vn' },
        secret_token: 'khong-duoc-lo',
      },
    ],
  });
  const ctx = buildCtx({ params: { type: 'news', id: 'doc-x' } });
  await resources.get(ctx);
  assert.ok(!('secret_token' in ctx.body.data));
  assert.ok(!('createdBy' in ctx.body.data));
  assert.equal(ctx.body.data.title, 'A');
});

test('sửa bản ghi không tồn tại thì báo không tìm thấy', async () => {
  useStrapi({ [NEWS]: [] });
  const ctx = buildCtx({ params: { type: 'news', id: 'khong-co' } });
  await resources.get(ctx);
  assert.equal(ctx.status, 404);
  assert.equal(ctx.body.error.code, 'NOT_FOUND');
});

test('module chỉ đọc không cho tạo hay xoá, nhưng vẫn đổi được trạng thái', async () => {
  const fake = useStrapi({ [ORDERS]: [{ documentId: 'don-1', customer_name: 'A', status: 'new' }] });

  const created = buildCtx({ params: { type: 'order-requests' }, body: { data: { customer_name: 'giả' } } });
  await resources.create(created);
  assert.equal(created.status, 403);
  assert.equal(created.body.error.code, 'READ_ONLY');

  const removed = buildCtx({ params: { type: 'order-requests', id: 'don-1' } });
  await resources.delete(removed);
  assert.equal(removed.status, 403);

  const updated = buildCtx({
    params: { type: 'order-requests', id: 'don-1' },
    body: { data: { status: 'done', customer_name: 'sửa trộm' } },
  });
  await resources.update(updated);
  assert.equal(updated.status, 200);
  const call = fake.__calls.find((entry) => entry.method === 'update');
  assert.deepEqual(call.data, { status: 'done' }, 'chỉ trạng thái được ghi');
});

// --- slug trùng --------------------------------------------------------------

test('slug trùng được thêm hậu tố, kể cả khi trùng nhiều lần', async () => {
  const fake = useStrapi({
    [NEWS]: [
      { documentId: 'doc-a', title: 'Giá đồng', slug: 'gia-dong' },
      { documentId: 'doc-b', title: 'Giá đồng', slug: 'gia-dong-2' },
    ],
  });
  const ctx = buildCtx({
    params: { type: 'news' },
    body: { data: { title: 'Giá đồng', slug: 'gia-dong', summary: 's', content: 'c', category: 'gia-ca', date: '2026-01-01' } },
  });
  await resources.create(ctx);
  assert.equal(fake.__calls.find((entry) => entry.method === 'create').data.slug, 'gia-dong-3');
});

test('lưu lại chính bản ghi đó không tự đổi slug của nó', async () => {
  const fake = useStrapi({ [NEWS]: [{ documentId: 'doc-a', title: 'Giá đồng', slug: 'gia-dong', publishedAt: '2026-01-01T00:00:00.000Z' }] });
  const ctx = buildCtx({
    params: { type: 'news', id: 'doc-a' },
    body: { data: { title: 'Giá đồng (cập nhật)', slug: 'gia-dong' } },
  });
  await resources.update(ctx);
  assert.equal(fake.__calls.find((entry) => entry.method === 'update').data.slug, 'gia-dong');
});

test('slug rỗng thì không sinh hậu tố lung tung', async () => {
  const fake = useStrapi({ [NEWS]: [{ documentId: 'doc-a', slug: '' }] });
  const ctx = buildCtx({
    params: { type: 'news' },
    body: { data: { title: 'A', slug: '   ', summary: 's', content: 'c', category: 'gia-ca', date: '2026-01-01' } },
  });
  await resources.create(ctx);
  assert.equal(fake.__calls.find((entry) => entry.method === 'create').data.slug, '   ');
});

// --- xuất bản ----------------------------------------------------------------

test('bấm Lưu là nội dung lên web ngay với module có bản nháp', async () => {
  const fake = useStrapi({ [NEWS]: [] });
  const ctx = buildCtx({
    params: { type: 'news' },
    body: { data: { title: 'A', slug: 'a', summary: 's', content: 'c', category: 'gia-ca', date: '2026-01-01' } },
  });
  await resources.create(ctx);
  assert.ok(fake.__calls.some((entry) => entry.method === 'publish'), 'tạo mới thì xuất bản luôn');
});

test('bản ghi đã gỡ khỏi web thì lưu tiếp vẫn nằm ngoài web', async () => {
  const fake = useStrapi({ [NEWS]: [{ documentId: 'doc-a', title: 'A', slug: 'a', publishedAt: null }] });
  const ctx = buildCtx({ params: { type: 'news', id: 'doc-a' }, body: { data: { title: 'A2' } } });
  await resources.update(ctx);
  assert.ok(!fake.__calls.some((entry) => entry.method === 'publish'), 'không tự đưa lại lên web');
});

test('bản ghi đang hiển thị trên web thì lưu xong được xuất bản lại', async () => {
  const fake = useStrapi({ [NEWS]: [{ documentId: 'doc-a', title: 'A', slug: 'a', publishedAt: '2026-01-01T00:00:00.000Z' }] });
  const ctx = buildCtx({ params: { type: 'news', id: 'doc-a' }, body: { data: { title: 'A2' } } });
  await resources.update(ctx);
  assert.ok(fake.__calls.some((entry) => entry.method === 'publish'));
});

test('module không có bản nháp thì không gọi xuất bản và chặn nút xuất bản', async () => {
  const fake = useStrapi({ [PRODUCTS]: [{ documentId: 'sp-1', name: 'A', uid: 'a' }] });

  const saved = buildCtx({ params: { type: 'products', id: 'sp-1' }, body: { data: { name: 'B' } } });
  await resources.update(saved);
  assert.ok(!fake.__calls.some((entry) => entry.method === 'publish'));

  for (const run of [resources.publish, resources.unpublish]) {
    const ctx = buildCtx({ params: { type: 'products', id: 'sp-1' } });
    await run(ctx);
    assert.equal(ctx.status, 400);
    assert.equal(ctx.body.error.code, 'PUBLISH_UNSUPPORTED');
  }
});

test('danh sách hiện đúng mốc xuất bản của bản đã đăng, không phải của bản nháp', async () => {
  useStrapi({
    [NEWS]: [
      { documentId: 'doc-a', title: 'Đã đăng', slug: 'a', date: '2026-01-02', publishedAt: '2026-01-02T00:00:00.000Z' },
      { documentId: 'doc-b', title: 'Nháp', slug: 'b', date: '2026-01-01', publishedAt: null },
    ],
  });
  const ctx = buildCtx({ params: { type: 'news' } });
  await resources.list(ctx);
  const byTitle = Object.fromEntries(ctx.body.data.map((row) => [row.title, row.publishedAt]));
  assert.equal(byTitle['Đã đăng'], '2026-01-02T00:00:00.000Z');
  assert.equal(byTitle['Nháp'], null);
});

// --- single type -------------------------------------------------------------

test('module một bản ghi trả thẳng bản ghi đó, chưa có thì trả null', async () => {
  useStrapi({ [SETTINGS]: [] });
  const empty = buildCtx({ params: { type: 'site-setting' } });
  await resources.list(empty);
  assert.equal(empty.body.data, null);
  assert.equal(empty.body.meta.total, 0);

  useStrapi({ [SETTINGS]: [{ documentId: 'st-1', office_name: 'DHA' }] });
  const filled = buildCtx({ params: { type: 'site-setting' } });
  await resources.list(filled);
  assert.equal(filled.body.data.office_name, 'DHA');
});

test('lưu module một bản ghi khi chưa có bản ghi nào thì tạo mới', async () => {
  const fake = useStrapi({ [SETTINGS]: [] });
  const ctx = buildCtx({ params: { type: 'site-setting', id: 'null' }, body: { data: { office_name: 'DHA' } } });
  await resources.update(ctx);
  assert.ok(fake.__calls.some((entry) => entry.method === 'create'));
  assert.equal(ctx.body.data.office_name, 'DHA');
});

test('lưu module một bản ghi khi đã có bản ghi thì sửa đúng bản ghi đó', async () => {
  const fake = useStrapi({ [SETTINGS]: [{ documentId: 'st-1', office_name: 'Cũ' }] });
  const ctx = buildCtx({ params: { type: 'site-setting', id: 'null' }, body: { data: { office_name: 'Mới' } } });
  await resources.update(ctx);
  const update = fake.__calls.find((entry) => entry.method === 'update');
  assert.equal(update.documentId, 'st-1');
  assert.equal(fake.__rows(SETTINGS).length, 1, 'không đẻ thêm bản ghi thứ hai');
});
