// Gắn liên kết trong bài viết tin tức. Nút Liên kết vốn đã có, nhưng chuẩn hoá
// địa chỉ thì sai với link nội bộ và không chặn địa chỉ nguy hiểm.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const importLib = () => import(`file://${path.join(root, 'admin/src/lib/link.js')}`);

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('địa chỉ gõ thiếu https vẫn thành link đúng', async () => {
  const { normalizeLinkHref } = await importLib();

  assert.equal(normalizeLinkHref('vnexpress.net/bai-viet'), 'https://vnexpress.net/bai-viet');
  assert.equal(normalizeLinkHref('www.vnexpress.net'), 'https://www.vnexpress.net');
  assert.equal(normalizeLinkHref('https://dhakimloaimau.vn'), 'https://dhakimloaimau.vn');
  assert.equal(normalizeLinkHref('  https://dhakimloaimau.vn  '), 'https://dhakimloaimau.vn', 'khoảng trắng thừa khi dán bị cắt');
});

test('link tới trang khác trong website giữ nguyên, không bị ghép thành https:///', async () => {
  const { normalizeLinkHref } = await importLib();

  assert.equal(normalizeLinkHref('/products'), '/products');
  assert.equal(normalizeLinkHref('/tin-tuc/gia-dong-2026'), '/tin-tuc/gia-dong-2026');
  assert.equal(normalizeLinkHref('#bang-gia'), '#bang-gia', 'link nhảy tới mục trong bài');
});

test('gõ email hay số điện thoại thành link gọi/gửi thư', async () => {
  const { normalizeLinkHref } = await importLib();

  assert.equal(normalizeLinkHref('daihoaian1256@gmail.com'), 'mailto:daihoaian1256@gmail.com');
  assert.equal(normalizeLinkHref('mailto:a@b.vn'), 'mailto:a@b.vn');
  assert.equal(normalizeLinkHref('tel:0867259078'), 'tel:0867259078');
});

test('địa chỉ nguy hiểm bị từ chối thay vì gắn vào bài', async () => {
  const { normalizeLinkHref } = await importLib();

  for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:void(0)', 'data:text/html,<script>']) {
    assert.equal(normalizeLinkHref(bad), null, `${bad} không được thành liên kết`);
  }
  assert.equal(normalizeLinkHref(''), null);
  assert.equal(normalizeLinkHref('   '), null);
});

test('trình soạn thảo dùng chung bộ chuẩn hoá này và có cách gỡ liên kết', () => {
  const source = read('admin/src/components/RichTextField.jsx');

  assert.match(source, /normalizeLinkHref/, 'không tự chuẩn hoá địa chỉ một kiểu riêng');
  assert.match(source, /unsetLink/, 'gỡ được liên kết đã gắn');
  assert.match(source, /Gỡ liên kết/, 'có nút gỡ riêng, không bắt người dùng đoán là phải xoá trắng ô');
});

test('bấm Liên kết khi chưa bôi đen chữ thì chèn luôn địa chỉ làm chữ hiển thị', () => {
  const source = read('admin/src/components/RichTextField.jsx');

  assert.match(source, /selection\.empty|state\.selection/, 'có xét trường hợp chưa chọn chữ nào');
  assert.match(source, /insertContent/, 'chèn chữ mới thay vì gắn mark vào chỗ trống');
});

test('địa chỉ mà trang tin tức từ chối thì trình soạn thảo cũng không tạo ra', () => {
  // app.js chỉ giữ http/https/mailto/tel và đường dẫn nội bộ; admin phải cùng
  // một danh sách, nếu không biên tập viên gắn xong lại thấy link biến mất.
  assert.match(read('app.js'), /\^\(https\?:\|mailto:\|tel:\)/, 'danh sách giao thức của trang công khai');
  assert.match(read('admin/src/lib/link.js'), /mailto/, 'admin dùng cùng danh sách');
});

// Khớp mã nguồn chỉ chứng minh có gọi đúng tên hàm. Phần dễ sai là Tiptap có
// thật sự tạo ra thẻ <a> hay không, nên dựng hẳn một editor để thử.
test('editor thật tạo đúng thẻ liên kết cho cả ba tình huống', async (t) => {
  const tiptap = path.join(root, 'admin/node_modules/@tiptap');
  if (!fs.existsSync(tiptap)) {
    t.skip('chưa cài admin/node_modules — chạy `npm run admin:install` để kiểm phần này');
    return;
  }

  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { pretendToBeVisual: true });
  const restore = [];
  for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'DocumentFragment', 'MutationObserver', 'getComputedStyle', 'DOMParser', 'Range', 'Selection']) {
    restore.push([key, globalThis[key]]);
    globalThis[key] = key === 'window' ? dom.window : dom.window[key];
  }
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  t.after(() => restore.forEach(([key, value]) => { globalThis[key] = value; }));

  const { Editor } = await import(`file://${tiptap}/core/dist/index.js`);
  const { default: StarterKit } = await import(`file://${tiptap}/starter-kit/dist/index.js`);
  const { default: Link } = await import(`file://${tiptap}/extension-link/dist/index.js`);
  const { normalizeLinkHref } = await importLib();

  const editor = new Editor({
    element: dom.window.document.getElementById('app'),
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Link.configure({ openOnClick: false, autolink: false })],
    content: '<p>Chào bạn</p>',
  });

  // Chưa bôi đen chữ nào: địa chỉ được chèn làm chữ hiển thị.
  editor.commands.focus('end');
  const href = normalizeLinkHref('vnexpress.net/tin');
  editor.chain().focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
  assert.match(editor.getHTML(), /<a[^>]*href="https:\/\/vnexpress\.net\/tin"[^>]*>https:\/\/vnexpress\.net\/tin<\/a>/);

  // Bôi đen rồi gắn link tới trang trong website.
  editor.commands.setContent('<p>Xem sản phẩm</p>');
  editor.commands.setTextSelection({ from: 1, to: 14 });
  editor.chain().focus().extendMarkRange('link').setLink({ href: normalizeLinkHref('/products') }).run();
  assert.match(editor.getHTML(), /<a[^>]*href="\/products"[^>]*>Xem sản phẩm<\/a>/, 'link nội bộ không bị ghép thành https:///');

  // Gỡ liên kết trả lại chữ trơn.
  editor.chain().focus().extendMarkRange('link').unsetLink().run();
  assert.equal(editor.getHTML(), '<p>Xem sản phẩm</p>');
});
