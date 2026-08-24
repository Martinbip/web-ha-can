'use strict';

// Dựng thật hai màn hình dễ sai nhất của admin — Thanh menu và ô chọn ảnh —
// rồi thao tác như biên tập viên: thêm mục, ẩn mục, lưu, gặp lỗi từ máy chủ.
const assert = require('node:assert/strict');
const test = require('node:test');

const { isAvailable, loadComponent, render, tryRequire, mockFetch } = require('./helpers/render-admin');

const available = isAvailable();
const options = available ? {} : { skip: 'cần chạy npm run admin:install trước' };

let React;

function component(file) {
  return loadComponent(file).default;
}

function react() {
  if (!React) React = tryRequire('react');
  return React;
}

function navItems() {
  return [
    { id: 'trang-chu', label: 'Trang chủ', url: '/', visible: true, children: [] },
    {
      id: 'san-pham',
      label: 'Sản phẩm',
      url: '/products',
      visible: true,
      children: [{ id: 'dong', label: 'Đồng', url: '/products', visible: true, children: [] }],
    },
  ];
}

async function renderMenu(routes) {
  const calls = mockFetch(routes);
  const MenuPage = component('admin/src/pages/MenuPage.jsx');
  const view = await render(react().createElement(MenuPage));
  // Cho các promise của lần tải đầu chạy xong.
  await view.act(async () => {});
  view.dom.window.confirm = () => true;
  return { view, calls };
}

// --- Thanh menu --------------------------------------------------------------

test('thanh menu: tải xong hiện đủ mục cha, mục con và bản xem trước', options, async () => {
  const { view } = await renderMenu({ 'GET /navigation': () => ({ body: { data: { items: navItems() } } }) });
  assert.equal(view.all('.menu-row').length, 3);
  assert.equal(view.all('.menu-row.is-child').length, 1);
  assert.match(view.one('.menu-preview').textContent, /Trang chủ/);
  view.unmount();
});

test('thanh menu: chưa sửa gì thì nút Lưu khoá, sửa rồi thì mở', options, async () => {
  const { view } = await renderMenu({ 'GET /navigation': () => ({ body: { data: { items: navItems() } } }) });
  const saveButton = view.byText('button', 'Lưu thay đổi');
  assert.equal(saveButton.disabled, true, 'chưa sửa thì không cho lưu');

  const labelInput = view.all('.menu-fields input')[0];
  await view.type(labelInput, 'Trang chủ mới');
  assert.equal(view.byText('button', 'Lưu thay đổi').disabled, false);
  assert.match(view.text(), /Có thay đổi chưa lưu/);
  view.unmount();
});

test('thanh menu: thêm mục mới rồi lưu gửi lên đúng cây 2 cấp', options, async () => {
  let saved = null;
  const { view, calls } = await renderMenu({
    'GET /navigation': () => ({ body: { data: { items: navItems() } } }),
    'PUT /navigation': ({ body }) => {
      saved = body.data.items;
      return { body: { data: { items: body.data.items } } };
    },
  });

  await view.click(view.byText('button', 'Thêm mục'));
  const inputs = view.all('.menu-row .menu-fields input');
  await view.type(inputs[inputs.length - 2], 'Liên hệ');
  await view.type(inputs[inputs.length - 1], '/contact');
  await view.click(view.byText('button', 'Lưu thay đổi'));

  assert.ok(saved, 'có gửi yêu cầu lưu');
  assert.equal(saved.length, 3);
  assert.equal(saved[2].label, 'Liên hệ');
  assert.equal(saved[1].children.length, 1, 'mục con vẫn nằm trong mục cha');
  assert.equal(calls.filter((call) => call.method === 'PUT').length, 1);
  assert.match(view.text(), /Đã lưu thanh menu/);
  view.unmount();
});

test('thanh menu: máy chủ báo lỗi thì hiện lỗi và giữ nguyên nội dung đang nhập', options, async () => {
  const { view } = await renderMenu({
    'GET /navigation': () => ({ body: { data: { items: navItems() } } }),
    'PUT /navigation': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', message: 'Mục 1: thiếu tên hiển thị.' } } }),
  });

  const labelInput = view.all('.menu-fields input')[0];
  await view.type(labelInput, '');
  await view.click(view.byText('button', 'Lưu thay đổi'));

  assert.match(view.text(), /thiếu tên hiển thị/);
  assert.equal(view.all('.menu-row').length, 3, 'không mất mục nào');
  assert.equal(view.byText('button', 'Lưu thay đổi').disabled, false, 'vẫn cho lưu lại sau khi sửa');
  view.unmount();
});

test('thanh menu: không tải được thì báo lỗi chứ không để màn hình trắng', options, async () => {
  const { view } = await renderMenu({
    'GET /navigation': () => ({ status: 500, body: { error: { message: 'Máy chủ đang bận.' } } }),
  });
  assert.match(view.text(), /Máy chủ đang bận|Không tải được/);
  view.unmount();
});

test('thanh menu: đường dẫn chưa có trang được cảnh báo, đường dẫn có thật thì không', options, async () => {
  const { view } = await renderMenu({ 'GET /navigation': () => ({ body: { data: { items: navItems() } } }) });
  const urlInput = view.all('.menu-fields input')[1];

  await view.type(urlInput, '/khuyen-mai');
  assert.equal(view.all('.menu-warning').length, 1);

  await view.type(urlInput, '/products/dong');
  assert.equal(view.all('.menu-warning').length, 0);

  await view.type(urlInput, 'https://facebook.com/dha');
  assert.equal(view.all('.menu-warning').length, 0, 'liên kết ngoài không bị cảnh báo 404');
  view.unmount();
});

test('thanh menu: ẩn một mục thì bản xem trước bỏ mục đó đi', options, async () => {
  const { view } = await renderMenu({ 'GET /navigation': () => ({ body: { data: { items: navItems() } } }) });
  assert.match(view.one('.menu-preview').textContent, /Trang chủ/);

  const hideButton = view.all('.menu-row')[0].querySelector('[aria-label^="Ẩn"]');
  await view.click(hideButton);
  assert.doesNotMatch(view.one('.menu-preview').textContent, /Trang chủ/);
  view.unmount();
});

test('thanh menu: mục đầu tiên không thụt vào được, mục con luôn có nút trả về cấp 1', options, async () => {
  const { view } = await renderMenu({ 'GET /navigation': () => ({ body: { data: { items: navItems() } } }) });
  const rows = view.all('.menu-row');
  assert.equal(rows[0].querySelector('[aria-label^="Cho"]').disabled, true);
  assert.ok(rows[2].querySelector('[aria-label*="trở lại cấp 1"]'), 'mục con có nút đưa lên cấp 1');
  view.unmount();
});

test('thanh menu: xoá mục cha xoá luôn mục con', options, async () => {
  const { view } = await renderMenu({ 'GET /navigation': () => ({ body: { data: { items: navItems() } } }) });
  const deleteButton = view.all('.menu-row')[1].querySelector('[aria-label^="Xoá"]');
  await view.click(deleteButton);
  assert.equal(view.all('.menu-row').length, 1);
  view.unmount();
});

test('thanh menu: hoàn tác đưa mọi thứ về bản đã lưu', options, async () => {
  const { view } = await renderMenu({ 'GET /navigation': () => ({ body: { data: { items: navItems() } } }) });
  await view.type(view.all('.menu-fields input')[0], 'Sửa lung tung');
  await view.click(view.byText('button', 'Hoàn tác'));
  assert.equal(view.all('.menu-fields input')[0].value, 'Trang chủ');
  assert.equal(view.byText('button', 'Lưu thay đổi').disabled, true);
  view.unmount();
});

test('thanh menu: xoá hết mục thì có lối thêm lại mục đầu tiên', options, async () => {
  const { view } = await renderMenu({ 'GET /navigation': () => ({ body: { data: { items: [] } } }) });
  assert.ok(view.byText('button', 'Thêm mục đầu tiên'), 'menu rỗng vẫn thêm lại được');
  view.unmount();
});

// --- Ô chọn ảnh --------------------------------------------------------------

async function renderPicker(routes, props = {}) {
  const calls = mockFetch(routes);
  const ImagePicker = component('admin/src/components/ImagePicker.jsx');
  const state = { value: props.value ?? '', cleared: 0, selected: null };
  const R = react();

  function Harness() {
    const [value, setValue] = R.useState(state.value);
    state.value = value;
    return R.createElement(ImagePicker, {
      id: 'anh',
      folder: 'dha/news',
      ...props,
      value,
      onChange: setValue,
      onSelect: (asset) => {
        state.selected = asset;
      },
      onClear: () => {
        state.cleared += 1;
      },
    });
  }

  const view = await render(R.createElement(Harness));
  await view.act(async () => {});
  return { view, state, calls };
}

const asset = (id) => ({ public_id: id, secure_url: `https://res.cloudinary.com/x/${id}.jpg` });

test('ô chọn ảnh: mở thư viện lấy cả ảnh mới lẫn ảnh trước khi đổi tên thương hiệu', options, async () => {
  const { view, calls } = await renderPicker({
    'GET /media': ({ path }) => ({
      body: { data: path.includes('ha-can') ? [asset('ha-can/news/cu')] : [asset('dha/news/moi')] },
    }),
  });

  await view.click(view.byText('button', 'Chọn ảnh có sẵn'));
  await view.act(async () => {});
  assert.equal(view.all('.image-picker-grid-item').length, 2);
  assert.equal(calls.filter((call) => call.path.startsWith('/media')).length, 2);
  view.unmount();
});

test('ô chọn ảnh: một thư mục lỗi thì vẫn hiện ảnh của thư mục còn lại', options, async () => {
  const { view } = await renderPicker({
    'GET /media': ({ path }) =>
      path.includes('ha-can')
        ? { status: 500, body: { error: { message: 'Hỏng' } } }
        : { body: { data: [asset('dha/news/moi')] } },
  });

  await view.click(view.byText('button', 'Chọn ảnh có sẵn'));
  await view.act(async () => {});
  assert.equal(view.all('.image-picker-grid-item').length, 1);
  assert.doesNotMatch(view.text(), /Không tải được thư viện/);
  view.unmount();
});

test('ô chọn ảnh: cả hai thư mục lỗi thì báo rõ chứ không hiện lưới trống', options, async () => {
  const { view } = await renderPicker({
    'GET /media': () => ({ status: 500, body: { error: { message: 'Hỏng' } } }),
  });
  await view.click(view.byText('button', 'Chọn ảnh có sẵn'));
  await view.act(async () => {});
  assert.match(view.text(), /Không tải được thư viện ảnh/);
  view.unmount();
});

test('ô chọn ảnh: chọn một ảnh là điền vào trường và đóng thư viện', options, async () => {
  const { view, state } = await renderPicker({
    'GET /media': () => ({ body: { data: [asset('dha/news/moi')] } }),
  });
  await view.click(view.byText('button', 'Chọn ảnh có sẵn'));
  await view.act(async () => {});
  await view.click(view.all('.image-picker-grid-item')[0]);

  assert.equal(state.value, 'https://res.cloudinary.com/x/dha/news/moi.jpg');
  assert.equal(state.selected.public_id, 'dha/news/moi');
  assert.equal(view.all('.image-picker-panel').length, 0, 'thư viện đóng lại sau khi chọn');
  view.unmount();
});

test('ô chọn ảnh: máy chủ từ chối ảnh quá nặng thì hiện đúng lời nhắc', options, async () => {
  const { view, state } = await renderPicker({
    'GET /media': () => ({ body: { data: [] } }),
    'POST /media/upload': () => ({
      status: 413,
      body: { error: { code: 'FILE_TOO_LARGE', message: 'Ảnh tải lên không được vượt quá 5MB.' } },
    }),
  });

  await view.click(view.byText('button', 'Tải lại'));
  await view.act(async () => {});
  // Không chọn file thì nhắc chọn file trước.
  assert.match(view.text(), /Vui lòng chọn ảnh/);

  const file = new view.dom.window.File(['x'.repeat(10)], 'anh.png', { type: 'image/png' });
  const input = view.one('input[type="file"]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await view.act(async () => {
    input.dispatchEvent(new view.dom.window.Event('change', { bubbles: true }));
  });

  assert.match(view.text(), /không được vượt quá 5MB/);
  assert.equal(state.value, '', 'ảnh hỏng không được ghi vào trường');
  view.unmount();
});

test('ô chọn ảnh: tải lên xong tự gán ảnh vừa tải, không cần bấm thêm', options, async () => {
  const { view, state } = await renderPicker({
    'GET /media': () => ({ body: { data: [] } }),
    'POST /media/upload': () => ({ body: { data: asset('dha/news/vua-tai') } }),
  });

  const file = new view.dom.window.File(['x'], 'anh.png', { type: 'image/png' });
  const input = view.one('input[type="file"]');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await view.act(async () => {
    input.dispatchEvent(new view.dom.window.Event('change', { bubbles: true }));
  });

  assert.equal(state.value, 'https://res.cloudinary.com/x/dha/news/vua-tai.jpg');
  assert.equal(state.selected.public_id, 'dha/news/vua-tai');
  view.unmount();
});

test('ô chọn ảnh: bỏ ảnh trả trường về rỗng và báo cho trường public_id đi kèm', options, async () => {
  const { view, state } = await renderPicker(
    { 'GET /media': () => ({ body: { data: [] } }) },
    { value: 'https://res.cloudinary.com/x/dha/news/cu.jpg' },
  );
  await view.click(view.byText('button', 'Bỏ ảnh'));
  assert.equal(state.value, '');
  assert.equal(state.cleared, 1);
  view.unmount();
});
