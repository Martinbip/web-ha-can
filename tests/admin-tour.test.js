// Tour hướng dẫn neo vào thuộc tính `data-tour` trên giao diện. Mốc bị đổi tên
// hay xoá đi thì tour im lặng bỏ qua bước đó — người quản trị không thấy lỗi,
// chỉ thấy bài hướng dẫn tự nhiên thiếu mất một đoạn. Test này canh đúng chỗ đó.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const adminSrc = path.join(root, 'admin/src');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function collectSources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSources(full);
    return /\.jsx?$/.test(entry.name) ? [fs.readFileSync(full, 'utf8')] : [];
  });
}

function matchAll(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const steps = read('admin/src/tour/tourSteps.js');
const shell = read('admin/src/layout/AdminShell.jsx');
const resourceConfig = read('admin/src/config/resources.js');

// Mọi mốc có thể xuất hiện trên giao diện: viết thẳng trong JSX, hoặc sinh động
// từ khoá nhóm menu (AdminShell) và loại ô nhập (FieldRenderer).
function availableAnchors() {
  const literal = collectSources(adminSrc).flatMap((source) => matchAll(source, /data-tour="([^"]+)"/g));
  const navKeys = matchAll(shell, /key:\s*'([a-z-]+)',\s*\n\s*title:/g).map((key) => `nav-${key}`);
  const fieldTypes = matchAll(resourceConfig, /type:\s*'([a-z-]+)'/g).map((type) => `field-${type}`);
  return new Set([...literal, ...navKeys, ...fieldTypes]);
}

test('mọi bước trong tour đều neo vào một mốc có thật trên giao diện', () => {
  const anchors = availableAnchors();
  const targets = matchAll(steps, /target:\s*'\[data-tour="([^"]+)"\]'/g);

  assert.ok(targets.length > 20, 'tour có đủ bước để đáng gọi là hướng dẫn');
  for (const target of targets) {
    assert.ok(anchors.has(target), `mốc data-tour="${target}" phải tồn tại trong admin/src`);
  }
});

test('mỗi màn hình chính của admin có một tour riêng', () => {
  for (const id of ['overview', 'resource-list', 'resource-edit', 'home', 'pricing', 'menu', 'media', 'settings', 'form-labels']) {
    assert.match(steps, new RegExp(`'?${id}'?:\\s*\\{`), `có tour cho ${id}`);
  }
});

test('mọi đường dẫn trong App.jsx đều được ánh xạ sang một tour', () => {
  const app = read('admin/src/App.jsx');
  // Các route có màn hình riêng; "/" là dashboard nên đã nằm trong tour tổng quan,
  // còn "/login" ở ngoài khu quản trị nên không có gì để hướng dẫn.
  const routes = matchAll(app, /<Route path="(\/[a-z-]+)"/g).filter((route) => route !== '/login');

  assert.ok(routes.length >= 6, 'đọc được danh sách route');
  for (const route of routes) {
    assert.match(steps, new RegExp(`\\^\\\\${route}\\$`), `có ánh xạ tour cho ${route}`);
  }
});

test('tour tổng quan tự chạy lần đầu và ghi nhớ đã xem', () => {
  const provider = read('admin/src/tour/TourProvider.jsx');

  assert.match(provider, /localStorage/, 'ghi nhớ trong trình duyệt');
  assert.match(provider, /OVERVIEW_TOUR_ID/, 'tự chạy tour tổng quan');
  // Tour từng màn hình không được tự bật: mở trang nào cũng bị lớp phủ chặn thì phiền.
  assert.doesNotMatch(provider, /startTour\(pageTourId\)/, 'tour từng trang chỉ chạy khi người dùng bấm');
});

test('không mở tour khi không còn bước nào chạy được', () => {
  const provider = read('admin/src/tour/TourProvider.jsx');

  assert.match(provider, /steps\.length === 0/, 'tour rỗng thì không bật lớp phủ');
});

test('nút mở hướng dẫn nằm trên thanh trên cùng và có nhãn cho trình đọc màn hình', () => {
  const button = read('admin/src/tour/TourButton.jsx');

  assert.match(shell, /<TourButton \/>/, 'nút nằm trong thanh trên cùng');
  assert.match(button, /aria-label="Hướng dẫn sử dụng"/, 'có nhãn trợ năng');
  assert.match(button, /aria-expanded=\{open\}/, 'báo trạng thái đóng/mở của menu');
});

test('lớp phủ hướng dẫn đóng được bằng bàn phím', () => {
  const overlay = read('admin/src/tour/TourOverlay.jsx');

  assert.match(overlay, /'Escape'/, 'Esc đóng hướng dẫn');
  assert.match(overlay, /role="dialog"/, 'là hộp thoại');
  assert.match(overlay, /aria-modal="true"/, 'chặn phần nền phía sau');
});

// --- Phần dưới chạy thật hàm tính toán của tour, không chỉ đọc mã nguồn ---

const { JSDOM } = require('jsdom');

const tourModule = () => import(`file://${path.join(root, 'admin/src/tour/tourSteps.js')}`);
const placementModule = () => import(`file://${path.join(root, 'admin/src/tour/tourPlacement.js')}`);

test('đường dẫn được ánh xạ đúng sang tour của màn hình đó', async () => {
  const { tourIdForPath } = await tourModule();

  assert.equal(tourIdForPath('/'), 'overview');
  assert.equal(tourIdForPath('/resources/news'), 'resource-list');
  assert.equal(tourIdForPath('/resources/news/new'), 'resource-edit');
  assert.equal(tourIdForPath('/resources/news/abc123'), 'resource-edit');
  assert.equal(tourIdForPath('/menu'), 'menu');
  assert.equal(tourIdForPath('/form-labels'), 'form-labels');
  // Dấu gạch chéo thừa ở cuối không được làm hỏng ánh xạ.
  assert.equal(tourIdForPath('/settings/'), 'settings');
  assert.equal(tourIdForPath('/khong-ton-tai'), null);
});

test('bước không có mốc trên màn hình thì bị loại khỏi tour', async () => {
  const { resolveSteps } = await placementModule();
  const { window } = new JSDOM('<main><div data-tour="list-table"></div></main>');

  const steps = [
    { target: '[data-tour="list-table"]' },
    { target: '[data-tour="list-actions"]' },   // bảng chưa có dòng nào
    { target: '[data-tour="list-pagination"]' }, // chỉ một trang
  ];

  const resolved = resolveSteps(steps, window.document);
  assert.deepEqual(resolved.map((step) => step.target), ['[data-tour="list-table"]']);
});

test('bong bóng chú thích lật hướng khi hết chỗ', async () => {
  const { placeTooltip } = await placementModule();
  const desktop = { width: 1440, height: 900 };

  // Menu bên trái còn thừa chỗ bên phải: giữ nguyên hướng phải.
  assert.equal(placeTooltip({ top: 200, left: 0, width: 248, height: 300 }, 'right', desktop).placement, 'right');

  // Mốc sát mép phải: không đủ chỗ cho bong bóng, phải rơi xuống dưới.
  assert.equal(placeTooltip({ top: 12, left: 1330, width: 90, height: 34 }, 'right', desktop).placement, 'bottom');

  // Mốc nằm cuối màn hình: đặt dưới thì tràn, phải lật lên trên.
  assert.equal(placeTooltip({ top: 820, left: 300, width: 400, height: 60 }, 'bottom', desktop).placement, 'top');

  // Màn hình hẹp: sidebar là ngăn kéo, mọi bong bóng đều nằm dưới.
  assert.equal(placeTooltip({ top: 200, left: 0, width: 248, height: 300 }, 'right', { width: 420, height: 800 }).placement, 'bottom');
});

test('bong bóng không bao giờ tràn ra ngoài mép màn hình', async () => {
  const { placeTooltip, EDGE } = await placementModule();
  const viewport = { width: 1024, height: 768 };

  const placed = placeTooltip({ top: 400, left: 990, width: 30, height: 30 }, 'bottom', viewport);
  assert.ok(placed.left >= EDGE, 'không lọt qua mép trái');
  assert.ok(placed.left + placed.width <= viewport.width - EDGE + 1, 'không tràn mép phải');
});

test('mốc nằm ngoài khung nhìn thì bỏ vòng sáng, bong bóng ra giữa màn hình', async () => {
  const { isOnScreen, centeredTooltip } = await placementModule();
  const viewport = { width: 1024, height: 768 };

  // Ngăn kéo menu đang đóng bị đẩy hẳn sang trái ngoài màn hình.
  assert.equal(isOnScreen({ top: 0, left: -248, width: 248, height: 700 }, viewport), false);
  assert.equal(isOnScreen({ top: 0, left: 0, width: 248, height: 700 }, viewport), true);
  assert.equal(isOnScreen(null, viewport), false);

  assert.equal(centeredTooltip(viewport).transform, 'translate(-50%, -50%)');
});

test('mốc cao gần hết màn hình vẫn giữ được bong bóng trong khung nhìn', async () => {
  const { placeTooltip, EDGE, CARD_HEIGHT } = await placementModule();
  // Thanh menu bên trái trên điện thoại: cao bằng cả màn hình, trên dưới đều chật.
  const viewport = { width: 375, height: 812 };
  const sidebar = { top: 0, left: 0, width: 240, height: 812 };

  const placed = placeTooltip(sidebar, 'right', viewport);
  const top = placed.transform === 'translateY(-100%)' ? placed.top - CARD_HEIGHT : placed.top;

  assert.ok(top >= EDGE - 1, 'không trồi lên trên mép');
  assert.ok(top + CARD_HEIGHT <= viewport.height - EDGE + 1, 'không rơi khỏi mép dưới');
});
