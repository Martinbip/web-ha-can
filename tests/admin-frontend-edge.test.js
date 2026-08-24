'use strict';

// Quét trường hợp biên của phần giao diện admin chạy trên trình duyệt: sinh
// đường dẫn bài viết, chuẩn hoá liên kết, và thao tác kéo/thụt cây menu.
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const load = (file) => import(`file://${path.join(root, file)}`);

// --- đường dẫn bài viết ------------------------------------------------------

test('đường dẫn sinh từ tiêu đề tiếng Việt, kể cả tiêu đề toàn ký tự lạ', async () => {
  const { slugify } = await load('admin/src/lib/slug.js');
  const cases = [
    ['Giá đồng hôm nay', 'gia-dong-hom-nay'],
    ['ĐỒNG ĐỎ Phế Liệu', 'dong-do-phe-lieu'],
    ['  Nhiều   khoảng   trắng  ', 'nhieu-khoang-trang'],
    ['Giá đồng: tăng 5% (tháng 7)', 'gia-dong-tang-5-thang-7'],
    ['---abc---', 'abc'],
    ['!!!', ''],
    ['', ''],
    ['   ', ''],
    ['日本語のタイトル', ''],
    ['Đường/dẫn\\có?ký&tự#lạ', 'duong-dan-co-ky-tu-la'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(slugify(input), expected, `slugify(${JSON.stringify(input)})`);
  }
});

test('đường dẫn dài bị cắt và không kết thúc bằng dấu gạch', async () => {
  const { slugify } = await load('admin/src/lib/slug.js');
  const slug = slugify(`${'a'.repeat(60)} ${'b'.repeat(80)}`);
  assert.ok(slug.length <= 120, `độ dài ${slug.length}`);
  assert.doesNotMatch(slug, /-$/, 'không để dấu gạch cuối sau khi cắt');
});

test('đường dẫn nhận cả giá trị không phải chuỗi mà không văng lỗi', async () => {
  const { slugify } = await load('admin/src/lib/slug.js');
  for (const input of [null, undefined, 0, 123, {}, []]) {
    assert.equal(typeof slugify(input), 'string', `slugify(${JSON.stringify(input)})`);
  }
});

// --- liên kết trong bài viết -------------------------------------------------

test('liên kết nguy hiểm bị từ chối thay vì gắn vào bài', async () => {
  const { normalizeLinkHref } = await load('admin/src/lib/link.js');
  const dangerous = [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    '  javascript:alert(1)  ',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://vi-du.vn/abc',
  ];
  for (const input of dangerous) {
    assert.equal(normalizeLinkHref(input), null, `phải từ chối: ${input}`);
  }
});

test('liên kết bỏ trống trả về null chứ không thành "https://"', async () => {
  const { normalizeLinkHref } = await load('admin/src/lib/link.js');
  for (const input of ['', '   ', null, undefined]) {
    assert.equal(normalizeLinkHref(input), null, `input ${JSON.stringify(input)}`);
  }
});

test('gõ thiếu https, gõ email hay số điện thoại đều thành liên kết đúng', async () => {
  const { normalizeLinkHref } = await load('admin/src/lib/link.js');
  assert.equal(normalizeLinkHref('dhacan.vn'), 'https://dhacan.vn');
  assert.equal(normalizeLinkHref('www.dhacan.vn/tin-tuc'), 'https://www.dhacan.vn/tin-tuc');
  assert.equal(normalizeLinkHref('lienhe@dhacan.vn'), 'mailto:lienhe@dhacan.vn');
  assert.equal(normalizeLinkHref('mailto:lienhe@dhacan.vn'), 'mailto:lienhe@dhacan.vn');
  assert.equal(normalizeLinkHref('tel:0900000000'), 'tel:0900000000');
  assert.equal(normalizeLinkHref('/products'), '/products');
  assert.equal(normalizeLinkHref('#lien-he'), '#lien-he');
});

test('liên kết ngoài trá hình đường dẫn nội bộ không được giữ nguyên', async () => {
  const { normalizeLinkHref } = await load('admin/src/lib/link.js');
  // Biên tập viên thấy "/..." tưởng là trang trong website, trình duyệt lại mở
  // sang tên miền khác.
  assert.notEqual(normalizeLinkHref('//ke-tan-cong.example'), '//ke-tan-cong.example');
  assert.notEqual(normalizeLinkHref('/\\ke-tan-cong.example'), '/\\ke-tan-cong.example');
});

// --- cây menu trên giao diện -------------------------------------------------

async function menuTree() {
  return load('admin/src/lib/menu-tree.js');
}

function rows(spec) {
  return spec.map(([label, depth], index) => ({
    key: `k${index}`,
    id: label.toLowerCase(),
    label,
    url: `/${label.toLowerCase()}`,
    visible: true,
    depth,
  }));
}

const shape = (list) => list.map((row) => [row.label, row.depth]);

test('mục con lạc mất cha thì tự lên cấp 1 thay vì biến mất', async () => {
  const { buildTree, normalizeDepths } = await menuTree();
  const orphan = rows([['Con', 1], ['Cha', 0]]);
  assert.deepEqual(shape(normalizeDepths(orphan)), [['Con', 0], ['Cha', 0]]);
  const tree = buildTree(orphan);
  assert.equal(tree.length, 2);
});

test('chuyển cây thành danh sách rồi ngược lại không mất mục nào', async () => {
  const { flattenTree, buildTree } = await menuTree();
  const original = [
    { id: 'a', label: 'A', url: '/a', visible: true, children: [{ id: 'a1', label: 'A1', url: '/a1', visible: false, children: [] }] },
    { id: 'b', label: 'B', url: '/b', visible: true, children: [] },
  ];
  const flat = flattenTree(original);
  assert.equal(flat.length, 3);
  const rebuilt = buildTree(flat);
  assert.equal(rebuilt.length, 2);
  assert.equal(rebuilt[0].children.length, 1);
  assert.equal(rebuilt[0].children[0].visible, false);
});

test('dữ liệu menu hỏng không làm màn hình trắng', async () => {
  const { flattenTree, buildTree } = await menuTree();
  for (const input of [null, undefined, 'menu', 42, {}]) {
    assert.deepEqual(flattenTree(input), [], `flattenTree(${JSON.stringify(input)})`);
    assert.deepEqual(buildTree(input), [], `buildTree(${JSON.stringify(input)})`);
  }
  assert.deepEqual(flattenTree([{}]), [
    { key: 'item-0', id: '', label: '', url: '', visible: true, depth: 0 },
  ]);
  assert.deepEqual(flattenTree([{ id: 'a', children: 'khong-phai-mang' }]).length, 1);
});

test('không cho mục đang có con tự thụt vào thành mục con', async () => {
  const { indentRow } = await menuTree();
  const list = rows([['Cha', 0], ['Con', 1], ['Sau', 0]]);
  assert.deepEqual(shape(indentRow(list, 0)), shape(list), 'mục đầu tiên không thụt được');
  const withChildren = rows([['A', 0], ['Cha', 0], ['Con', 1]]);
  assert.deepEqual(shape(indentRow(withChildren, 1)), shape(withChildren), 'mục có con không thụt được');
  assert.deepEqual(shape(indentRow(rows([['A', 0], ['B', 0]]), 1)), [['A', 0], ['B', 1]]);
});

test('kéo một mục cấp 1 luôn kéo theo mục con của nó', async () => {
  const { moveBlock, getBlockLength } = await menuTree();
  const list = rows([['A', 0], ['A1', 1], ['B', 0]]);
  assert.equal(getBlockLength(list, 0), 2);
  assert.equal(getBlockLength(list, 1), 1);
  assert.deepEqual(shape(moveBlock(list, 0, 3)), [['B', 0], ['A', 0], ['A1', 1]]);
});

test('kéo thả vào vị trí vô lý thì giữ nguyên, không làm mất mục', async () => {
  const { moveBlock } = await menuTree();
  const list = rows([['A', 0], ['A1', 1], ['B', 0]]);
  assert.deepEqual(shape(moveBlock(list, 0, 0)), shape(list), 'kéo về chính chỗ cũ');
  assert.deepEqual(shape(moveBlock(list, 0, 1)), shape(list), 'kéo vào giữa khối của chính nó');
  assert.equal(moveBlock(list, 0, 99).length, 3, 'kéo ra ngoài danh sách vẫn đủ mục');
  assert.equal(moveBlock(list, 0, -5).length, 3);
});

test('nút lên/xuống khoá đúng ở đầu và cuối danh sách', async () => {
  const { canMoveUp, canMoveDown, moveUpRow, moveDownRow } = await menuTree();
  const list = rows([['A', 0], ['A1', 1], ['B', 0]]);

  assert.equal(canMoveUp(list, 0), false);
  assert.equal(canMoveDown(list, 2), false);
  assert.equal(canMoveUp(list, 1), false, 'mục con đầu tiên không đổi chỗ lên trên cha');
  assert.equal(canMoveDown(list, 1), false, 'mục con không nhảy sang cha khác');

  assert.deepEqual(shape(moveUpRow(list, 0)), shape(list));
  assert.deepEqual(shape(moveDownRow(list, 2)), shape(list));
  assert.deepEqual(shape(moveDownRow(list, 0)), [['B', 0], ['A', 0], ['A1', 1]]);
});

test('xoá mục cấp 1 xoá luôn mục con, xoá mục con không đụng mục khác', async () => {
  const { removeRow } = await menuTree();
  const list = rows([['A', 0], ['A1', 1], ['B', 0]]);
  assert.deepEqual(shape(removeRow(list, 0)), [['B', 0]]);
  assert.deepEqual(shape(removeRow(list, 1)), [['A', 0], ['B', 0]]);
  assert.deepEqual(removeRow(rows([['A', 0]]), 0), []);
});

test('mỗi dòng mới có khoá riêng để React không nhầm dòng', async () => {
  const { createRow } = await menuTree();
  const keys = new Set([createRow().key, createRow().key, createRow(1).key]);
  assert.equal(keys.size, 3);
  assert.equal(createRow(1).depth, 1);
});
