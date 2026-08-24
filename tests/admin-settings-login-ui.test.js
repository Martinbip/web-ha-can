'use strict';

// Cài đặt website, đăng nhập và bảng tổng quan: các màn hình còn lại của admin.
const assert = require('node:assert/strict');
const test = require('node:test');

const { isAvailable, loadComponent, loadEntry, render, tryRequire, mockFetch } = require('./helpers/render-admin');

const available = isAvailable();
const options = available ? {} : { skip: 'cần chạy npm run admin:install trước' };

const SETTINGS = {
  documentId: 'st-1',
  office_name: 'Công ty DHA',
  hotline: '0900 000 000',
  email: 'lienhe@dhacan.vn',
  logo_text_main: 'DHA',
};

async function renderSettings(routes) {
  const calls = mockFetch(routes);
  const React = tryRequire('react');
  const SettingsPage = loadComponent('admin/src/pages/SettingsPage.jsx').default;
  const view = await render(React.createElement(SettingsPage));
  await view.act(async () => {});
  return { view, calls };
}

async function submitForm(view) {
  await view.act(async () => {
    view.one('form').dispatchEvent(new view.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await view.act(async () => {});
}

test('cài đặt: tải xong điền sẵn dữ liệu đang lưu', options, async () => {
  const { view } = await renderSettings({ 'GET /resources/site-setting': () => ({ body: { data: SETTINGS } }) });
  const values = view.all('input').map((input) => input.value);
  assert.ok(values.includes('Công ty DHA'));
  assert.ok(values.includes('0900 000 000'));
  view.unmount();
});

test('cài đặt: sửa rồi lưu gửi đúng bản ghi và báo đã lưu', options, async () => {
  let sent = null;
  const { view } = await renderSettings({
    'GET /resources/site-setting': () => ({ body: { data: SETTINGS } }),
    'PUT /resources/site-setting/st-1': ({ body }) => {
      sent = body.data;
      return { body: { data: { ...SETTINGS, ...body.data } } };
    },
  });

  const hotline = view.all('input').find((input) => input.value === '0900 000 000');
  await view.type(hotline, '0911 111 111');
  await submitForm(view);

  assert.ok(sent, 'có gửi yêu cầu lưu');
  assert.equal(sent.hotline, '0911 111 111');
  assert.match(view.text(), /Đã lưu cài đặt/);
  view.unmount();
});

test('cài đặt: máy chủ từ chối thì hiện lỗi, không báo nhầm là đã lưu', options, async () => {
  const { view } = await renderSettings({
    'GET /resources/site-setting': () => ({ body: { data: SETTINGS } }),
    'PUT /resources/site-setting/st-1': () => ({ status: 400, body: { error: { message: 'Email không hợp lệ.' } } }),
  });

  await submitForm(view);
  assert.match(view.text(), /Email không hợp lệ/);
  assert.doesNotMatch(view.text(), /Đã lưu cài đặt/);
  view.unmount();
});

test('cài đặt: không tải được thì báo lỗi rõ ràng', options, async () => {
  const { view } = await renderSettings({
    'GET /resources/site-setting': () => ({ status: 500, body: { error: { message: 'Máy chủ đang bận.' } } }),
  });
  assert.match(view.text(), /Máy chủ đang bận/);
  view.unmount();
});

test('cài đặt: CMS chưa có bản ghi nào thì vẫn lưu được lần đầu', options, async () => {
  let sent = null;
  const { view } = await renderSettings({
    'GET /resources/site-setting': () => ({ body: { data: null, meta: { page: 1, pageSize: 1, total: 0 } } }),
    'PUT /resources/site-setting/null': ({ body }) => {
      sent = body.data;
      return { body: { data: { documentId: 'st-moi', ...body.data } } };
    },
  });

  const office = view.all('input[type="text"]')[0];
  await view.type(office, 'Công ty DHA');
  await submitForm(view);

  assert.ok(sent, 'phải gửi được yêu cầu tạo bản ghi cài đặt đầu tiên');
  view.unmount();
});

// --- đăng nhập ---------------------------------------------------------------

async function renderLogin(routes) {
  const calls = mockFetch(routes);
  const React = tryRequire('react');
  const router = tryRequire('react-router-dom');
  // Cùng một bundle để AuthProvider và LoginPage dùng chung một React context.
  const { AuthProvider, LoginPage } = loadEntry(
    'login-entry.jsx',
    `export { AuthProvider } from './admin/src/auth/AuthProvider.jsx';
     export { default as LoginPage } from './admin/src/pages/LoginPage.jsx';`,
  );

  const view = await render(
    React.createElement(
      router.MemoryRouter,
      { initialEntries: ['/login'] },
      React.createElement(AuthProvider, null, React.createElement(LoginPage)),
    ),
  );
  await view.act(async () => {});
  return { view, calls };
}

test('đăng nhập: sai mật khẩu hiện đúng thông báo của máy chủ', options, async () => {
  const { view } = await renderLogin({
    'GET /auth/me': () => ({ status: 401, body: { error: { message: 'Vui lòng đăng nhập lại.' } } }),
    'POST /auth/login': () => ({ status: 401, body: { error: { message: 'Email hoặc mật khẩu không đúng.' } } }),
  });

  const [email, password] = view.all('input');
  await view.type(email, 'admin@dha.vn');
  await view.type(password, 'sai-mat-khau');
  await view.act(async () => {
    view.one('form').dispatchEvent(new view.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await view.act(async () => {});

  assert.match(view.text(), /Email hoặc mật khẩu không đúng/);
  view.unmount();
});

test('đăng nhập: ô email và mật khẩu đều bắt buộc, mật khẩu không hiện chữ', options, async () => {
  const { view } = await renderLogin({
    'GET /auth/me': () => ({ status: 401, body: {} }),
  });
  const [email, password] = view.all('input');
  assert.equal(email.type, 'email');
  assert.equal(email.required, true);
  assert.equal(password.type, 'password');
  assert.equal(password.required, true);
  view.unmount();
});

test('đăng nhập: máy chủ chết giữa chừng vẫn hiện được lời nhắc, không treo trang', options, async () => {
  const { view } = await renderLogin({
    'GET /auth/me': () => ({ status: 401, body: {} }),
    'POST /auth/login': () => ({ status: 500, body: {} }),
  });

  const [email, password] = view.all('input');
  await view.type(email, 'admin@dha.vn');
  await view.type(password, 'x');
  await view.act(async () => {
    view.one('form').dispatchEvent(new view.dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await view.act(async () => {});

  assert.match(view.text(), /Có lỗi xảy ra|không đúng/);
  view.unmount();
});

// --- bảng tổng quan ----------------------------------------------------------

test('tổng quan: hiện các thẻ số liệu, lỗi thì để trống chứ không vỡ trang', options, async () => {
  const React = tryRequire('react');
  const DashboardPage = loadComponent('admin/src/pages/DashboardPage.jsx').default;

  mockFetch({ 'GET /dashboard': () => ({ body: { cards: [{ type: 'news', label: 'Tin tức', count: 12 }] } }) });
  const ok = await render(React.createElement(DashboardPage));
  await ok.act(async () => {});
  assert.match(ok.text(), /Tin tức/);
  assert.match(ok.text(), /12/);
  ok.unmount();

  mockFetch({ 'GET /dashboard': () => ({ status: 500, body: {} }) });
  const failed = await render(React.createElement(DashboardPage));
  await failed.act(async () => {});
  assert.match(failed.text(), /Dashboard/);
  assert.equal(failed.all('.metric-card').length, 0);
  failed.unmount();
});
