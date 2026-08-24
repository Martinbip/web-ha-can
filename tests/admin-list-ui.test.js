'use strict';

// Màn hình danh sách và màn hình sửa của mỗi module — nơi biên tập viên xoá
// nhầm, xoá hàng loạt, tìm kiếm và lật trang.
const assert = require('node:assert/strict');
const test = require('node:test');

const { isAvailable, loadComponent, render, tryRequire, mockFetch } = require('./helpers/render-admin');

const available = isAvailable() && Boolean(safeResolve('react-router-dom'));
const options = available ? {} : { skip: 'cần chạy npm run admin:install trước' };

function safeResolve(name) {
  try {
    return require.resolve(name, { paths: [`${__dirname}/../admin/node_modules`] });
  } catch {
    return null;
  }
}

function news(index, overrides = {}) {
  return {
    documentId: `doc-${index}`,
    title: `Bài ${index}`,
    category: 'gia-ca',
    date: `2026-01-${String(index).padStart(2, '0')}`,
    publishedAt: index % 2 === 0 ? '2026-01-10T00:00:00.000Z' : null,
    ...overrides,
  };
}

async function renderList(routes, { type = 'news' } = {}) {
  const calls = mockFetch(routes);
  const React = tryRequire('react');
  const router = tryRequire('react-router-dom');
  const ResourceListPage = loadComponent('admin/src/pages/ResourceListPage.jsx').default;

  const element = React.createElement(
    router.MemoryRouter,
    { initialEntries: [`/resources/${type}`] },
    React.createElement(
      router.Routes,
      null,
      React.createElement(router.Route, {
        path: '/resources/:type',
        element: React.createElement(ResourceListPage),
      }),
    ),
  );

  const view = await render(element);
  await view.act(async () => {});
  view.dom.window.confirm = () => true;
  return { view, calls };
}

test('danh sách: hiện đúng trạng thái nháp/đã đăng của từng bài', options, async () => {
  const { view } = await renderList({
    'GET /resources/news': () => ({ body: { data: [news(1), news(2)], meta: { page: 1, pageSize: 20, total: 2 } } }),
  });
  assert.equal(view.all('.status-pill.is-draft').length, 1);
  assert.equal(view.all('.status-pill.is-published').length, 1);
  view.unmount();
});

test('danh sách: chưa có dữ liệu thì nói rõ, không hiện bảng trống khó hiểu', options, async () => {
  const { view } = await renderList({
    'GET /resources/news': () => ({ body: { data: [], meta: { page: 1, pageSize: 20, total: 0 } } }),
  });
  assert.match(view.text(), /Chưa có dữ liệu/);
  view.unmount();
});

test('danh sách: lỗi tải được báo ra màn hình', options, async () => {
  const { view } = await renderList({
    'GET /resources/news': () => ({ status: 500, body: { error: { message: 'Máy chủ đang bận.' } } }),
  });
  assert.match(view.text(), /Máy chủ đang bận/);
  view.unmount();
});

test('danh sách: tìm kiếm gửi từ khoá lên máy chủ và quay về trang 1', options, async () => {
  const { view, calls } = await renderList({
    'GET /resources/news': () => ({ body: { data: [news(1)], meta: { page: 3, pageSize: 20, total: 60 } } }),
  });

  await view.type(view.one('.search-form input'), 'đồng');
  await view.click(view.byText('button', 'Tìm'));
  await view.act(async () => {});

  const last = calls[calls.length - 1];
  assert.match(last.path, /search=/);
  assert.match(decodeURIComponent(last.path), /đồng/);
  assert.match(last.path, /page=1/);
  view.unmount();
});

test('danh sách: lật trang giữ nguyên trang đầu/cuối không bấm được', options, async () => {
  const { view, calls } = await renderList({
    'GET /resources/news': () => ({ body: { data: [news(1)], meta: { page: 1, pageSize: 20, total: 45 } } }),
  });

  const [prev, next] = view.all('.pagination button');
  assert.equal(prev.disabled, true, 'ở trang 1 thì không lùi được');
  assert.equal(next.disabled, false);
  assert.match(view.one('.pagination').textContent, /Trang 1 \/ 3/);

  await view.click(next);
  assert.match(calls[calls.length - 1].path, /page=2/);
  view.unmount();
});

test('danh sách: xoá một mục hỏi xác nhận rồi tải lại danh sách', options, async () => {
  const deleted = [];
  const { view } = await renderList({
    'GET /resources/news': () => ({ body: { data: [news(1), news(2)], meta: { page: 1, pageSize: 20, total: 2 } } }),
    'DELETE /resources/news/doc-1': () => {
      deleted.push('doc-1');
      return { body: { ok: true } };
    },
  });

  let confirmed = '';
  view.dom.window.confirm = (message) => {
    confirmed = message;
    return true;
  };

  await view.click(view.all('tbody tr')[0].querySelector('.btn-danger'));
  await view.act(async () => {});
  assert.match(confirmed, /không thể hoàn tác/);
  assert.deepEqual(deleted, ['doc-1']);
  view.unmount();
});

test('danh sách: bấm huỷ ở hộp xác nhận thì không xoá gì', options, async () => {
  const deleted = [];
  const { view } = await renderList({
    'GET /resources/news': () => ({ body: { data: [news(1)], meta: { page: 1, pageSize: 20, total: 1 } } }),
    'DELETE /resources/news/doc-1': () => {
      deleted.push('doc-1');
      return { body: { ok: true } };
    },
  });
  view.dom.window.confirm = () => false;
  await view.click(view.one('tbody .btn-danger'));
  await view.act(async () => {});
  assert.deepEqual(deleted, []);
  view.unmount();
});

test('danh sách: chọn tất cả rồi xoá hàng loạt, lỗi giữa chừng thì báo rõ', options, async () => {
  const deleted = [];
  const { view } = await renderList({
    'GET /resources/news': () => ({ body: { data: [news(1), news(2), news(3)], meta: { page: 1, pageSize: 20, total: 3 } } }),
    'DELETE /resources/news/doc-1': () => {
      deleted.push('doc-1');
      return { body: { ok: true } };
    },
    'DELETE /resources/news/doc-2': () => ({ status: 409, body: { error: { message: 'Bài này đang được dùng.' } } }),
    'DELETE /resources/news/doc-3': () => {
      deleted.push('doc-3');
      return { body: { ok: true } };
    },
  });

  await view.check(view.one('input[aria-label="Chọn tất cả"]'), true);
  assert.match(view.text(), /Xóa 3 mục đã chọn/);

  await view.click(view.byText('button', 'Xóa 3 mục đã chọn'));
  await view.act(async () => {});

  assert.deepEqual(deleted, ['doc-1'], 'dừng ngay ở mục lỗi đầu tiên');
  assert.match(view.text(), /Bài này đang được dùng/);
  view.unmount();
});

test('danh sách: chọn tất cả rồi bỏ chọn thì nút xoá hàng loạt biến mất', options, async () => {
  const { view } = await renderList({
    'GET /resources/news': () => ({ body: { data: [news(1), news(2)], meta: { page: 1, pageSize: 20, total: 2 } } }),
  });
  const selectAll = view.one('input[aria-label="Chọn tất cả"]');
  await view.check(selectAll, true);
  assert.ok(view.byText('button', 'mục đã chọn'));
  await view.check(selectAll, false);
  assert.equal(view.byText('button', 'mục đã chọn'), undefined);
  view.unmount();
});

test('danh sách: xuất bản và gỡ xuất bản gọi đúng endpoint theo trạng thái hiện tại', options, async () => {
  const hits = [];
  const { view } = await renderList({
    'GET /resources/news': () => ({ body: { data: [news(1), news(2)], meta: { page: 1, pageSize: 20, total: 2 } } }),
    'POST /resources/news/doc-1/publish': () => {
      hits.push('publish doc-1');
      return { body: { data: {} } };
    },
    'POST /resources/news/doc-2/unpublish': () => {
      hits.push('unpublish doc-2');
      return { body: { data: {} } };
    },
  });

  const rows = view.all('tbody tr');
  await view.click(rows[0].querySelector('.btn-secondary'));
  await view.act(async () => {});
  await view.click(view.all('tbody tr')[1].querySelector('.btn-secondary'));
  await view.act(async () => {});

  assert.deepEqual(hits, ['publish doc-1', 'unpublish doc-2']);
  view.unmount();
});

test('danh sách: module chỉ đọc không có nút thêm, xoá hay chọn hàng loạt', options, async () => {
  const { view } = await renderList(
    {
      'GET /resources/order-requests': () => ({
        body: {
          data: [{ documentId: 'don-1', customer_name: 'A', product_name: 'Đồng', status: 'new' }],
          meta: { page: 1, pageSize: 20, total: 1 },
        },
      }),
    },
    { type: 'order-requests' },
  );

  assert.equal(view.byText('a', 'Thêm mới'), undefined);
  assert.equal(view.one('input[aria-label="Chọn tất cả"]'), null);
  assert.equal(view.one('tbody .btn-danger'), null);
  view.unmount();
});

test('danh sách: ô giá trị rỗng, số 0 và dữ liệu dạng bảng đều hiện được', options, async () => {
  const { view } = await renderList(
    {
      'GET /resources/products': () => ({
        body: {
          data: [
            { documentId: 'sp-1', name: 'Đồng tấm', group: 'dong', price: 0, featured: true, in_stock: false },
            { documentId: 'sp-2', name: 'Nhôm', group: null, price: null, featured: false, in_stock: true },
          ],
          meta: { page: 1, pageSize: 20, total: 2 },
        },
      }),
    },
    { type: 'products' },
  );

  const text = view.one('tbody').textContent;
  assert.match(text, /Liên hệ/, 'giá 0 và giá trống hiện chữ thay thế');
  assert.match(text, /Có/);
  assert.match(text, /Không/);
  view.unmount();
});

test('danh sách: module lạ thì báo không tìm thấy thay vì vỡ giao diện', options, async () => {
  const { view } = await renderList({ 'GET *': () => ({ body: { data: [], meta: {} } }) }, { type: 'khong-ton-tai' });
  assert.match(view.text(), /Không tìm thấy module/);
  view.unmount();
});
