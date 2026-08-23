// Nút Lưu vốn nằm cuối form: form dài (bài viết, cài đặt website) thì phải cuộn
// hết xuống đáy mới bấm được. Chuyển lên đầu và cho bám theo màn hình.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

// Mọi màn hình có nút Lưu — sót một cái là quản trị lại phải nhớ chỗ nào kiểu nào.
const EDIT_PAGES = [
  'admin/src/pages/ResourceEditPage.jsx',
  'admin/src/pages/SettingsPage.jsx',
  'admin/src/pages/FormLabelsPage.jsx',
  'admin/src/pages/HomePageEditor.jsx',
  'admin/src/pages/MenuPage.jsx',
];

test('mọi màn hình có nút Lưu đều dùng chung một thanh lưu', () => {
  for (const file of EDIT_PAGES) {
    assert.match(read(file), /SaveBar/, `${file} dùng thanh lưu chung`);
  }
});

test('không còn nút Lưu nằm lẻ ở cuối form', () => {
  for (const file of EDIT_PAGES) {
    const source = read(file);
    assert.doesNotMatch(source, /className="form-actions"/, `${file} bỏ cụm nút cuối form`);
    assert.doesNotMatch(source, /className="menu-savebar"/, `${file} bỏ thanh lưu bám đáy riêng`);
  }
});

test('thanh lưu bám đầu màn hình, nằm dưới thanh trên cùng', () => {
  const css = read('admin/src/styles.css');
  const block = css.split('.savebar {')[1].split('}')[0];

  assert.match(block, /position:\s*sticky/, 'bám theo màn hình khi cuộn');
  assert.match(block, /top:/, 'bám vào cạnh trên chứ không phải cạnh dưới');
  assert.doesNotMatch(block, /^\s*bottom:/m, 'không còn bám đáy (border-bottom không tính)');
  // Thanh trên cùng của admin cũng sticky ở top: 0, chồng lên nhau thì che mất nút.
  assert.match(block, /top:\s*(58|var\(--topbar-height\))/, 'đặt ngay dưới thanh trên cùng');
});

test('thanh lưu nói rõ đang lưu và khoá nút để không bấm hai lần', () => {
  const source = read('admin/src/components/SaveBar.jsx');

  assert.match(source, /Đang lưu\.\.\./, 'có trạng thái đang lưu');
  assert.match(source, /disabled=\{/, 'khoá nút trong lúc lưu');
});

// Thanh lưu ban đầu chỉ có hai nút dồn sát phải, nửa trái trống trơn — nhìn như
// một dải trắng thừa, mà cuộn xuống giữa form dài thì cũng không còn biết đang
// sửa gì. Cho tiêu đề trang vào chính thanh đó.
test('thanh lưu mang tiêu đề trang, không để trống nửa bên trái', () => {
  const source = read('admin/src/components/SaveBar.jsx');

  assert.match(source, /title/, 'nhận tiêu đề');
  assert.match(source, /savebar-title/, 'tiêu đề có chỗ đứng riêng trong thanh');
  assert.doesNotMatch(source, /<div className="savebar-status" \/>/, 'không còn ô rỗng chèn chỗ');

  for (const file of EDIT_PAGES) {
    assert.match(read(file), /title=/, `${file} truyền tiêu đề vào thanh lưu`);
  }
});

test('tiêu đề không hiện hai lần', () => {
  // Trang nào đã đưa tiêu đề vào thanh lưu thì bỏ khối tiêu đề cũ đi.
  // page-heading vẫn dùng cho tiêu đề mục con (h2) — chỉ tiêu đề trang (h1) là
  // không được lặp lại.
  for (const file of ['admin/src/pages/SettingsPage.jsx', 'admin/src/pages/HomePageEditor.jsx', 'admin/src/pages/FormLabelsPage.jsx', 'admin/src/pages/MenuPage.jsx']) {
    assert.doesNotMatch(read(file), /<h1>/, `${file} chỉ còn tiêu đề trang nằm trong thanh lưu`);
  }
});

test('nút Lưu vẫn gửi được form dù thanh nằm ngoài thẻ form', () => {
  const savebar = read('admin/src/components/SaveBar.jsx');

  assert.match(savebar, /form=\{formId\}/, 'nút trỏ tới form bằng thuộc tính form');
  for (const file of ['admin/src/pages/ResourceEditPage.jsx', 'admin/src/pages/SettingsPage.jsx', 'admin/src/pages/HomePageEditor.jsx', 'admin/src/pages/FormLabelsPage.jsx']) {
    const source = read(file);
    assert.match(source, /<form[^>]*id=/, `${file} đặt id cho form`);
    assert.match(source, /formId=/, `${file} nối thanh lưu với form đó`);
  }
});

test('thanh lưu tách khỏi nội dung bên dưới bằng viền và bóng', () => {
  const css = read('admin/src/styles.css');
  const block = css.split('.savebar {')[1].split('}')[0];

  assert.match(block, /box-shadow:/, 'có bóng để không dính bệt vào nội dung khi cuộn');
  // Kéo âm cả bốn phía padding của .page: trải hết chiều ngang và dán sát thanh
  // trên cùng, không để hở khe xám.
  assert.match(block, /margin:\s*-28px -28px/, 'trải hết chiều ngang và dán sát thanh trên cùng');
});
