'use strict';

// Dựng thật một component React của admin trong jsdom để bấm nút, gõ chữ và
// xem giao diện phản ứng ra sao — thứ mà đọc mã nguồn bằng regex không thấy
// được. Cần `npm run admin:install` trước; thiếu thì test gọi tới sẽ tự bỏ qua.
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '..', '..');
const adminModules = path.join(root, 'admin', 'node_modules');

// react-dom (và mọi thứ kéo theo nó, như react-router-dom) dò khả năng của
// trình duyệt ngay lúc nạp module. Nạp khi chưa có `document` là nó khoá cứng ở
// chế độ không-DOM và onChange của các ô nhập liệu ngừng chạy trong test.
const DOM_FREE_PACKAGES = new Set(['esbuild', 'jsdom']);

function tryRequire(name) {
  if (!DOM_FREE_PACKAGES.has(name) && !global.document) createDom();
  try {
    return require(require.resolve(name, { paths: [adminModules, root] }));
  } catch {
    return null;
  }
}

// Chỉ kiểm tra gói có mặt hay không: nạp thật react-dom khi chưa dựng jsdom sẽ
// khiến nó khoá cứng ở chế độ không-DOM và onChange ngừng chạy trong test.
function isAvailable() {
  return ['esbuild', 'react', 'react-dom', 'jsdom'].every((name) => {
    try {
      require.resolve(name, { paths: [adminModules, root] });
      return true;
    } catch {
      return false;
    }
  });
}

const bundleCache = new Map();

// Gộp nhiều file admin vào cùng một bundle. Cần khi hai file phải dùng chung
// một React context (AuthProvider + LoginPage): bundle riêng lẻ sẽ tạo ra hai
// bản context khác nhau và useContext trả về null.
function loadEntry(name, source) {
  return loadComponent(name, source);
}

function loadComponent(relativePath, source) {
  if (bundleCache.has(relativePath)) return bundleCache.get(relativePath);

  // react-dom dò xem trình duyệt có sự kiện `input` hay không ngay lúc nạp
  // module. Nạp nó khi chưa có `document` (bundle kéo theo react-dom) thì nó
  // rơi về chế độ không-DOM và onChange của mọi ô nhập liệu ngừng chạy trong
  // test. Vì vậy phải dựng jsdom trước khi biên dịch/bundle bất cứ thứ gì.
  if (!global.document) createDom();

  const esbuild = tryRequire('esbuild');
  const result = esbuild.buildSync({
    ...(source
      ? { stdin: { contents: source, resolveDir: root, sourcefile: relativePath, loader: 'jsx' } }
      : { entryPoints: [path.join(root, relativePath)] }),
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react-router-dom'],
    define: { 'import.meta.env.VITE_ADMIN_API_BASE': '"/api/admin-ui"' },
    jsx: 'automatic',
    logLevel: 'silent',
  });

  const code = result.outputFiles[0].text;
  const module_ = new Module(relativePath, null);
  module_.filename = path.join(root, relativePath);
  module_.paths = [adminModules, path.join(root, 'node_modules')];
  module_._compile(code, module_.filename);
  bundleCache.set(relativePath, module_.exports);
  return module_.exports;
}

// Mỗi lần render dựng một cửa sổ jsdom riêng để state của test trước không rơi
// sang test sau.
function createDom() {
  const { JSDOM } = tryRequire('jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:3000/admin/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true, writable: true });
  global.HTMLElement = window.HTMLElement;
  global.Element = window.Element;
  global.Node = window.Node;
  global.Event = window.Event;
  global.MouseEvent = window.MouseEvent;
  global.KeyboardEvent = window.KeyboardEvent;
  global.getComputedStyle = window.getComputedStyle.bind(window);
  global.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
  global.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

async function render(element) {
  const dom = createDom();
  const React = tryRequire('react');
  const ReactDOM = tryRequire('react-dom/client');
  const { act } = tryRequire('react-dom/test-utils');

  const container = dom.window.document.getElementById('root');
  const rootNode = ReactDOM.createRoot(container);

  await act(async () => {
    rootNode.render(element);
  });

  return {
    dom,
    container,
    React,
    async act(fn) {
      await act(async () => {
        await fn();
      });
    },
    async click(node) {
      await act(async () => {
        node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      });
    },
    async type(input, value) {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
      await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    },
    async check(input, checked) {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'checked').set;
      await act(async () => {
        setter.call(input, checked);
        input.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
      });
    },
    text() {
      return container.textContent;
    },
    all(selector) {
      return [...container.querySelectorAll(selector)];
    },
    one(selector) {
      return container.querySelector(selector);
    },
    byText(selector, label) {
      return [...container.querySelectorAll(selector)].find((node) => node.textContent.includes(label));
    },
    unmount() {
      act(() => rootNode.unmount());
      dom.window.close();
    },
  };
}

// Giả lập lớp mạng: các trang admin đều gọi qua fetch() tới /api/admin-ui.
// routes = { 'GET /navigation': () => ({ status, body }) }
function mockFetch(routes) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const path = String(url).replace('/api/admin-ui', '');
    const key = `${method} ${path.split('?')[0]}`;
    calls.push({ method, path, key, options, body: parseBody(options.body) });

    const handler = routes[key] || routes[`${method} *`];
    if (!handler) throw new Error(`Test chưa khai báo tuyến ${key}`);

    const result = await handler({ method, path, body: parseBody(options.body), options });
    const status = result && result.status ? result.status : 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (result && 'body' in result ? result.body : {}),
    };
  };
  return calls;
}

function parseBody(body) {
  if (!body || typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

module.exports = { isAvailable, loadComponent, loadEntry, render, tryRequire, mockFetch };
