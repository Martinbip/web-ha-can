'use strict';

// Dựng thật các ô nhập liệu của admin trong trình duyệt giả để kiểm tra thao
// tác của biên tập viên: thêm dòng thông số, sửa tên thông số, tick danh mục.
const assert = require('node:assert/strict');
const test = require('node:test');

const { isAvailable, loadComponent, render, tryRequire } = require('./helpers/render-admin');

const available = isAvailable();
const options = available ? {} : { skip: 'cần chạy npm run admin:install trước' };

let FieldRenderer;
let React;

function field(config) {
  const state = { value: config.value };
  const props = {
    name: config.name || 'specs',
    field: config.field,
    value: state.value,
    values: config.values || {},
    onChange: (next) => {
      state.value = next;
    },
    setField: () => {},
  };
  return { state, props };
}

async function renderField(config) {
  if (!FieldRenderer) {
    FieldRenderer = loadComponent('admin/src/components/FieldRenderer.jsx').default;
    React = tryRequire('react');
  }
  const { state, props } = field(config);

  function Harness() {
    const [value, setValue] = React.useState(config.value);
    state.value = value;
    return React.createElement(FieldRenderer, {
      ...props,
      value,
      onChange: (next) => setValue(next),
    });
  }

  const view = await render(React.createElement(Harness));
  return { view, state };
}

test('bảng thông số: bấm Thêm dòng phải hiện ra một dòng trống để gõ', options, async () => {
  const { view } = await renderField({ field: { label: 'Thông số', type: 'key-value-table' }, value: {} });
  const addButton = view.byText('button', 'Thêm dòng');
  await view.click(addButton);
  assert.equal(view.all('.kv-row').length, 1, 'phải có 1 dòng sau khi bấm thêm');
  view.unmount();
});

test('bảng thông số: gõ giá trị trước rồi mới gõ tên thông số vẫn giữ được giá trị', options, async () => {
  const { view, state } = await renderField({
    field: { label: 'Thông số', type: 'key-value-table' },
    value: { 'Độ tinh khiết': '' },
  });
  const [keyInput, valueInput] = view.all('.kv-row input');
  await view.type(valueInput, '99.9%');
  await view.type(keyInput, 'Độ tinh khiết (Cu)');
  assert.deepEqual(state.value, { 'Độ tinh khiết (Cu)': '99.9%' });
  view.unmount();
});

test('bảng thông số: xoá đúng dòng được bấm', options, async () => {
  const { view, state } = await renderField({
    field: { label: 'Thông số', type: 'key-value-table' },
    value: { A: '1', B: '2', C: '3' },
  });
  const removeButtons = view.all('.kv-row button');
  await view.click(removeButtons[1]);
  assert.deepEqual(state.value, { A: '1', C: '3' });
  view.unmount();
});

test('bảng thông số: dữ liệu cũ không phải object không làm hỏng màn hình', options, async () => {
  for (const value of [null, 'chuoi', 42, []]) {
    const { view } = await renderField({ field: { label: 'Thông số', type: 'key-value-table' }, value });
    assert.ok(view.one('.kv-table'), `value ${JSON.stringify(value)} vẫn dựng được bảng`);
    view.unmount();
  }
});

test('danh sách chữ: thêm rồi gõ được từng dòng, xoá đúng dòng', options, async () => {
  const { view, state } = await renderField({
    field: { label: 'Tính năng', type: 'text-list' },
    value: ['Giao nhanh'],
  });
  await view.click(view.byText('button', 'Thêm dòng'));
  assert.equal(view.all('.text-list-row').length, 2, 'thêm được dòng mới');

  const inputs = view.all('.text-list-row input');
  await view.type(inputs[1], 'Bao test mẫu');
  assert.deepEqual(state.value, ['Giao nhanh', 'Bao test mẫu']);

  await view.click(view.all('.text-list-row button')[0]);
  assert.deepEqual(state.value, ['Bao test mẫu']);
  view.unmount();
});

test('ô số bỏ trống lưu thành null chứ không phải chuỗi rỗng hay 0', options, async () => {
  const { view, state } = await renderField({ field: { label: 'Giá', type: 'number' }, value: 285000, name: 'price' });
  const input = view.one('input[type="number"]');
  await view.type(input, '');
  assert.equal(state.value, null);
  view.unmount();
});

test('ô ngày nhận cả mốc thời gian đầy đủ lẫn ngày trống', options, async () => {
  const full = await renderField({ field: { label: 'Ngày', type: 'date' }, value: '2026-03-15T08:30:00.000Z', name: 'date' });
  assert.equal(full.view.one('input[type="date"]').value, '2026-03-15');
  full.view.unmount();

  const empty = await renderField({ field: { label: 'Ngày', type: 'date' }, value: null, name: 'date' });
  assert.equal(empty.view.one('input[type="date"]').value, '');
  empty.view.unmount();
});

test('ô chọn một giá trị hiện đúng lựa chọn đang lưu, kể cả giá trị lạ', options, async () => {
  const { view } = await renderField({
    field: { label: 'Nhóm', type: 'select', options: ['dong', 'nhom'] },
    value: 'gia-tri-khong-con-trong-danh-sach',
    name: 'group',
  });
  const select = view.one('select');
  assert.equal(select.value, '', 'giá trị không còn hợp lệ thì về ô trống thay vì hiện bừa');
  view.unmount();
});

test('trường bắt buộc được đánh dấu sao và trường chỉ đọc bị khoá', options, async () => {
  const required = await renderField({ field: { label: 'Tiêu đề', type: 'text', required: true }, value: '', name: 'title' });
  assert.ok(required.view.one('.field-required'), 'có dấu sao');
  assert.equal(required.view.one('input').required, true);
  required.view.unmount();

  const readOnly = await renderField({ field: { label: 'Email', type: 'text', readOnly: true }, value: 'a@b.vn', name: 'email' });
  assert.equal(readOnly.view.one('input').disabled, true);
  assert.match(readOnly.view.text(), /chỉ đọc/);
  readOnly.view.unmount();
});

test('liên kết chân trang: thêm, gõ, đổi thứ tự, ẩn và xoá được', options, async () => {
  const { view, state } = await renderField({
    name: 'footer_links',
    field: { label: 'Liên kết chân trang', type: 'link-list' },
    value: [{ label: 'Tin Tức', url: '/news', visible: true }],
  });

  await view.click(view.byText('button', 'Thêm liên kết'));
  assert.equal(view.all('.link-list-row').length, 2, 'thêm được dòng mới');
  const [labelInput, urlInput] = view.all('.link-list-row')[1].querySelectorAll('input[type="text"]');
  await view.type(labelInput, 'Liên Hệ');
  await view.type(urlInput, '/contact');
  assert.deepEqual(state.value, [
    { label: 'Tin Tức', url: '/news', visible: true },
    { label: 'Liên Hệ', url: '/contact', visible: true },
  ]);

  await view.click(view.all('.link-list-row')[1].querySelector('button[aria-label="Đưa lên"]'));
  assert.deepEqual(state.value.map((item) => item.label), ['Liên Hệ', 'Tin Tức']);

  await view.check(view.all('.link-list-row')[0].querySelector('input[type="checkbox"]'), false);
  assert.equal(state.value[0].visible, false, 'tắt được công tắc hiện');

  await view.click(view.byText('.link-list-row button', 'Xóa'));
  assert.deepEqual(state.value.map((item) => item.label), ['Tin Tức'], 'xoá đúng dòng đầu');
  view.unmount();
});

test('liên kết chân trang: đường dẫn sai quy tắc hiện cảnh báo, dữ liệu hỏng không làm vỡ màn hình', options, async () => {
  const { view } = await renderField({
    name: 'footer_links',
    field: { label: 'Liên kết chân trang', type: 'link-list' },
    value: [{ label: 'Độc', url: 'javascript:alert(1)', visible: true }],
  });
  assert.match(view.one('.link-list-warning').textContent, /bắt đầu bằng/);
  view.unmount();

  for (const value of [null, 'chuoi', 42, {}, ['chu']]) {
    const { view: broken } = await renderField({
      name: 'footer_links',
      field: { label: 'Liên kết chân trang', type: 'link-list' },
      value,
    });
    assert.ok(broken.one('.link-list'), `value ${JSON.stringify(value)} vẫn dựng được danh sách`);
    broken.unmount();
  }
});

test('liên kết chân trang: URL kiểu "//..." (protocol-relative) cũng bị cảnh báo', options, async () => {
  const { view } = await renderField({
    name: 'footer_links',
    field: { label: 'Liên kết chân trang', type: 'link-list' },
    value: [{ label: 'Ngoài', url: '//evil.com', visible: true }],
  });
  assert.ok(view.one('.link-list-warning'), '"//evil.com" trông như đường dẫn nội bộ nhưng thực ra dẫn ra ngoài');
  view.unmount();
});
