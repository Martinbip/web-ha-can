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

test('thanh lưu nằm trong form nên nút Lưu vẫn gửi được form đó', () => {
  const source = read('admin/src/pages/ResourceEditPage.jsx');
  const form = source.split('<form')[1].split('</form>')[0];

  assert.match(form, /SaveBar/, 'thanh lưu nằm bên trong thẻ form');
  assert.match(read('admin/src/components/SaveBar.jsx'), /'submit'/, 'nút Lưu mặc định là nút gửi form');
});

test('thanh lưu nói rõ đang lưu và khoá nút để không bấm hai lần', () => {
  const source = read('admin/src/components/SaveBar.jsx');

  assert.match(source, /Đang lưu\.\.\./, 'có trạng thái đang lưu');
  assert.match(source, /disabled=\{/, 'khoá nút trong lúc lưu');
});
