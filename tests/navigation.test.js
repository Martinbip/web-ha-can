const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const { normalizeTree, normalizeUrl } = require('../dha-cms/src/api/admin-ui/services/navigation');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

// app.js là script toàn cục chứ không phải module, nên để gọi được các hàm menu
// trong test ta chạy nó trong một sandbox có DOM giả tối thiểu.
function loadAppJs() {
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    fetch: async () => { throw new Error('offline'); },
    AbortSignal: { timeout: () => null },
    window: { location: { hostname: 'localhost', pathname: '/', hash: '' }, addEventListener() {}, innerWidth: 1280 },
    document: {
      addEventListener() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      body: { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} },
      createElement: () => ({ classList: { add() {} }, setAttribute() {}, style: {} }),
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('app.js'), sandbox);
  return sandbox;
}

function fakeLink(href) {
  const classes = new Set();
  return {
    href,
    getAttribute: () => href,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    closest: () => null,
    isActive: () => classes.has('active'),
  };
}

test('backend chỉ nhận đường dẫn nội bộ hoặc http(s)', () => {
  assert.equal(normalizeUrl('/products'), '/products');
  assert.equal(normalizeUrl('#services'), '#services');
  assert.equal(normalizeUrl('https://dhakimloaimau.vn'), 'https://dhakimloaimau.vn');
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('data:text/html,<script>'), null);
  assert.equal(normalizeUrl(''), null);
});

test('normalizeTree làm sạch dữ liệu và báo lỗi rõ ràng', () => {
  const { items, errors } = normalizeTree([
    { label: 'Sản Phẩm', url: '/products', children: [{ label: 'Đồng', url: '/products#dong' }] },
    { label: '', url: '/x' },
  ]);

  assert.equal(errors.length, 1, 'mục thiếu tên bị từ chối');
  assert.match(errors[0], /tên hiển thị/);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'san-pham', 'id tự sinh không dấu');
  assert.equal(items[0].children[0].label, 'Đồng');
});

test('normalizeTree chặn menu quá sâu và quá dài', () => {
  const deep = normalizeTree([
    { label: 'A', url: '/', children: [{ label: 'B', url: '/b', children: [{ label: 'C', url: '/c' }] }] },
  ]);
  assert.equal(deep.items[0].children[0].children.length, 0, 'cấp 3 bị bỏ');

  const many = normalizeTree(Array.from({ length: 21 }, (_, i) => ({ label: `M${i}`, url: '/' })));
  assert.ok(many.errors.length > 0, 'quá 20 mục cấp 1 bị từ chối');
});

test('menu-tree chuyển đổi được giữa cây và danh sách phẳng', async () => {
  const tree = await import(path.join(root, 'admin/src/lib/menu-tree.js'));
  const items = [
    { id: 'home', label: 'Trang Chủ', url: '/', visible: true, children: [] },
    { id: 'products', label: 'Sản Phẩm', url: '/products', visible: true, children: [
      { id: 'dong', label: 'Đồng', url: '/products#dong', visible: true, children: [] },
    ] },
  ];

  const rows = tree.flattenTree(items);
  assert.deepEqual(rows.map((row) => row.depth), [0, 0, 1]);
  assert.deepEqual(tree.buildTree(rows), items.map((item) => ({
    ...item,
    children: item.children.map((child) => ({ ...child })),
  })));
});

test('kéo một mục cha mang theo mục con của nó', async () => {
  const tree = await import(path.join(root, 'admin/src/lib/menu-tree.js'));
  const rows = tree.flattenTree([
    { id: 'a', label: 'A', url: '/a', children: [{ id: 'a1', label: 'A1', url: '/a1' }] },
    { id: 'b', label: 'B', url: '/b', children: [] },
  ]);

  const moved = tree.moveBlock(rows, 0, 3);
  assert.deepEqual(moved.map((row) => row.id), ['b', 'a', 'a1']);
  assert.deepEqual(moved.map((row) => row.depth), [0, 0, 1]);
});

test('thụt vào/ra đổi cấp mục, mục đầu danh sách luôn ở cấp 1', async () => {
  const tree = await import(path.join(root, 'admin/src/lib/menu-tree.js'));
  const rows = tree.flattenTree([
    { id: 'a', label: 'A', url: '/a', children: [] },
    { id: 'b', label: 'B', url: '/b', children: [] },
  ]);

  const indented = tree.indentRow(rows, 1);
  assert.equal(indented[1].depth, 1);
  assert.equal(tree.buildTree(indented)[0].children[0].id, 'b');

  assert.equal(tree.indentRow(rows, 0)[0].depth, 0, 'mục đầu tiên không thể thành mục con');
  assert.equal(tree.outdentRow(indented, 1)[1].depth, 0);
});

test('renderNavItems bỏ mục ẩn và chặn URL nguy hiểm', () => {
  const app = loadAppJs();
  const html = app.renderNavItems([
    { label: 'Trang Chủ', url: '/', visible: true, children: [] },
    { label: 'Ẩn', url: '/an', visible: false, children: [] },
    { label: 'Xấu', url: 'javascript:alert(1)', visible: true, children: [] },
    { label: 'Sản Phẩm', url: '/products', visible: true, children: [
      { label: 'Đồng', url: '/products#dong', visible: true },
    ] },
  ]);

  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /\/an/, 'mục ẩn không được render');
  assert.doesNotMatch(html, /javascript:/, 'URL nguy hiểm bị loại');
  assert.match(html, /has-submenu/, 'mục có con được đánh dấu');
  assert.match(html, /nav-submenu/, 'menu con được render');
});

test('renderNavItems escape nội dung do quản trị nhập', () => {
  const app = loadAppJs();
  const html = app.renderNavItems([
    { label: '<img src=x onerror=alert(1)>', url: '/x', visible: true, children: [] },
  ]);

  assert.doesNotMatch(html, /<img/, 'nhãn bị escape');
  assert.match(html, /&lt;img/);
});

test('markActiveNavLink đánh dấu đúng mục theo URL hiện tại', () => {
  const app = loadAppJs();
  const links = [fakeLink('/'), fakeLink('/#services'), fakeLink('/products'), fakeLink('/contact')];
  app.document.querySelectorAll = () => links;

  app.window.location = { pathname: '/products', hash: '' };
  app.markActiveNavLink();
  assert.ok(links[2].isActive(), 'trang sản phẩm active');
  assert.ok(!links[0].isActive());

  app.window.location = { pathname: '/', hash: '#services' };
  app.markActiveNavLink();
  assert.ok(links[1].isActive(), 'neo trong trang chủ active theo hash');

  app.window.location = { pathname: '/', hash: '' };
  app.markActiveNavLink();
  assert.ok(links[0].isActive(), 'trang chủ active khi không có hash');
});

test('trang con vẫn làm sáng mục menu cha', () => {
  const app = loadAppJs();
  const links = [fakeLink('/'), fakeLink('/news'), fakeLink('/products')];
  app.document.querySelectorAll = () => links;

  app.window.location = { pathname: '/news/gia-dong-tang', hash: '' };
  app.markActiveNavLink();
  assert.ok(links[1].isActive(), 'bài viết con làm sáng mục tin tức');
});

test('menu tĩnh trong HTML vẫn là bản dự phòng khi CMS lỗi', () => {
  const appJs = read('app.js');
  assert.match(appJs, /Giữ menu tĩnh trong HTML/, 'fetch lỗi thì không đụng vào menu tĩnh');

  for (const page of ['index.html', 'products.html', 'contact.html', 'news.html', 'pricing.html', 'projects.html', 'estimator.html', 'product-detail.html', 'news-detail.html']) {
    const html = read(page);
    assert.match(html, /class="nav-links"/, `${page} vẫn có menu tĩnh`);
    assert.match(html, /nav-link/, `${page} có link điều hướng dự phòng`);
  }
});

test('thanh menu được seed và đọc công khai từ CMS', () => {
  const bootstrap = read('dha-cms/src/index.js');
  const schema = JSON.parse(read('dha-cms/src/api/navigation/content-types/navigation/schema.json'));
  const { DEFAULT_NAV_ITEMS } = require('../dha-cms/src/api/navigation/default-items');

  assert.equal(schema.kind, 'singleType');
  assert.equal(schema.attributes.items.type, 'json');
  assert.match(bootstrap, /getDefaultNavItems/, 'menu được seed lúc bootstrap');
  assert.match(bootstrap, /'api::navigation\.navigation\.find'/, 'menu đọc được công khai');
  assert.equal(DEFAULT_NAV_ITEMS.length, 8, 'menu mặc định giữ đúng 8 mục hiện có');
});

// Deploy chỉ rsync thư mục dha-cms/ sang máy chủ Strapi, nên seed đọc file ở
// gốc repo sẽ luôn thất bại trên production.
test('menu mặc định nằm trong dha-cms chứ không đọc file ngoài', () => {
  const bootstrap = read('dha-cms/src/index.js');
  const defaults = read('dha-cms/src/api/navigation/default-items.js');

  assert.doesNotMatch(bootstrap, /navigation\.json/, 'không seed menu từ data/ ở gốc repo');
  assert.ok(!fs.existsSync(path.join(root, 'data/navigation.json')), 'file seed cũ đã bị bỏ');

  for (const label of ['Trang Chủ', 'Sản Phẩm', 'Liên Hệ']) {
    assert.match(defaults, new RegExp(label), `${label} có trong menu mặc định`);
  }
});

test('admin thấy menu mặc định khi CMS chưa có bản ghi nào', () => {
  const service = read('dha-cms/src/api/admin-ui/services/navigation.js');
  assert.match(service, /items\.length \? items : getDefaultNavItems\(\)/, 'GET trả menu mặc định khi rỗng');
});

test('admin có trang sửa thanh menu và gọi đúng endpoint', () => {
  const routes = read('dha-cms/src/api/admin-ui/routes/admin-ui.js');
  const shell = read('admin/src/layout/AdminShell.jsx');
  const app = read('admin/src/App.jsx');
  const page = read('admin/src/pages/MenuPage.jsx');

  assert.match(routes, /'\/admin-ui\/navigation'/, 'route admin-ui cho menu tồn tại');
  assert.match(shell, /Thanh menu/, 'sidebar có mục Thanh menu');
  assert.match(app, /path="\/menu"/, 'route /admin/menu tồn tại');
  assert.match(page, /draggable/, 'các mục kéo thả được');
  assert.match(page, /saveNavigation/, 'trang lưu được menu');
});
