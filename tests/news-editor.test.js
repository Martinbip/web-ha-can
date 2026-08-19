// Ba phản hồi của khách về phần quản trị tin tức — không chèn được ảnh vào bài,
// không hiểu phải điền gì ở ô đường dẫn, và danh sách đầy bản lưu trùng — được
// khoá lại ở đây để không tái diễn.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('đường dẫn bài viết được sinh tự động từ tiêu đề', async () => {
  const { slugify } = await import(`file://${path.join(root, 'admin/src/lib/slug.js')}`);

  assert.equal(
    slugify('Bước ngoặt lịch sử: Việt Nam lần đầu sản xuất nhôm thỏi'),
    'buoc-ngoat-lich-su-viet-nam-lan-dau-san-xuat-nhom-thoi',
    'dấu tiếng Việt và ký tự đặc biệt bị loại bỏ',
  );
  assert.equal(slugify('Đồng thỏi sập giá'), 'dong-thoi-sap-gia', 'đ được chuyển thành d');
  assert.equal(slugify('   '), '', 'tiêu đề rỗng cho slug rỗng chứ không phải gạch ngang');

  // Mọi tiêu đề, kể cả tiêu đề toàn ký tự lạ, phải cho ra slug mà Strapi chấp nhận.
  for (const title of ['Tiêu đề có dấu!', '@@@ ### ***', 'Giá đồng 2026 — dự báo Q3']) {
    assert.match(slugify(title), /^[a-z0-9-]*$/, `"${title}" chỉ còn ký tự Strapi chấp nhận`);
  }
});

test('form tin tức không có ô nhập đường dẫn — địa chỉ bài viết luôn bám theo tiêu đề', () => {
  const config = read('admin/src/config/resources.js');
  const fieldRenderer = read('admin/src/components/FieldRenderer.jsx');
  const slugField = read('admin/src/components/SlugField.jsx');
  const editPage = read('admin/src/pages/ResourceEditPage.jsx');

  assert.match(config, /slug:\s*{[^}]*type:\s*'slug'/s, 'slug dùng input chuyên biệt, không phải text thường');
  assert.match(config, /slug:\s*{[^}]*sourceField:\s*'title'/s, 'slug lấy nguồn từ tiêu đề');
  assert.match(fieldRenderer, /case 'slug':/, 'FieldRenderer xử lý kiểu slug');
  assert.match(slugField, /slugify\(sourceValue\)/, 'slug được sinh từ tiêu đề');
  assert.doesNotMatch(slugField, /<input/, 'không còn ô nhập để gõ sai vào');
  assert.doesNotMatch(slugField, /<button/, 'không còn nút nào phải bấm');
  assert.match(editPage, /withGeneratedSlugs\(config, values\)/, 'slug rỗng được sinh lại trước khi lưu');
});

test('nội dung bài viết soạn bằng trình soạn thảo có nút chèn ảnh', () => {
  const richText = read('admin/src/components/RichTextField.jsx');
  const config = read('admin/src/config/resources.js');
  const packageJson = JSON.parse(read('admin/package.json'));

  assert.ok(packageJson.dependencies['@tiptap/react'], 'admin phụ thuộc trình soạn thảo TipTap');
  assert.ok(packageJson.dependencies['@tiptap/extension-image'], 'trình soạn thảo hỗ trợ ảnh trong bài');
  assert.match(richText, /ImagePicker/, 'nút chèn ảnh dùng lại thư viện ảnh Cloudinary sẵn có');
  assert.match(richText, /setImage\(\{ src: url/, 'ảnh được chèn vào đúng vị trí con trỏ');
  assert.match(config, /content:\s*{[^}]*imageFolder:\s*'dha\/news'/s, 'ảnh trong bài lưu vào thư mục tin tức');
});

test('danh sách phân biệt bản nháp với bài đã đăng và cho xoá nhiều mục', () => {
  const listPage = read('admin/src/pages/ResourceListPage.jsx');
  const config = read('admin/src/config/resources.js');

  assert.match(listPage, /Bản nháp/, 'bản chưa xuất bản được gắn nhãn rõ ràng');
  assert.match(listPage, /Đã đăng/, 'bài đã lên web được gắn nhãn rõ ràng');
  assert.match(listPage, /handleBulkDelete/, 'có thao tác xoá nhiều mục cùng lúc');
  assert.doesNotMatch(config, /'publishedAt'/, 'cột dấu thời gian thô được thay bằng nhãn trạng thái');
});

test('bài viết có trang chi tiết riêng và nội dung được lọc trước khi hiển thị', () => {
  const appJs = read('app.js');
  const detailHtml = read('news-detail.html');
  const styles = read('styles.css');

  assert.match(detailHtml, /id="news-detail-content"/, 'trang chi tiết có vùng nội dung');
  assert.match(detailHtml, /og:image/, 'trang chi tiết khai báo thẻ chia sẻ mạng xã hội');
  assert.match(appJs, /initNewsDetailPage/, 'app.js dựng trang chi tiết');
  assert.match(appJs, /\/news-detail\?slug=/, 'thẻ tin tức dẫn sang bài viết theo slug');
  assert.match(
    appJs,
    /sanitizeArticleHtml\(articleContentToHtml\(article\.content\)\)/,
    'nội dung luôn đi qua bộ lọc trước khi gắn vào trang',
  );
  assert.match(appJs, /ARTICLE_DROPPED_TAGS[\s\S]*'SCRIPT'/, 'thẻ script bị loại bỏ hoàn toàn');
  assert.match(styles, /\.article-body img/, 'ảnh chèn giữa bài có kiểu hiển thị riêng');
});

test('slug trùng nhau được thêm hậu tố thay vì báo lỗi unique của Strapi', () => {
  const service = read('dha-cms/src/api/admin-ui/services/resources.js');

  assert.match(service, /ensureUniqueSlugs/, 'có bước bảo đảm slug duy nhất');
  assert.match(service, /\$\{base\}-\$\{suffix\}/, 'slug trùng được thêm hậu tố số');
  assert.match(
    service,
    /entry\.documentId !== documentId/,
    'bài đang sửa không tự coi mình là bản trùng',
  );
});
