const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('admin app is a Vite React app served from /admin', () => {
  const packageJson = JSON.parse(read('admin/package.json'));
  const app = read('admin/src/App.jsx');
  const client = read('admin/src/api/client.js');

  assert.ok(packageJson.dependencies.react, 'React dependency exists');
  assert.ok(packageJson.devDependencies.vite, 'Vite dev dependency exists');
  assert.equal(packageJson.scripts.build, 'vite build');
  assert.match(app, /BrowserRouter/, 'app uses browser routing');
  assert.match(client, /credentials:\s*['"]include['"]/, 'fetch includes HTTP-only auth cookie');
  assert.match(client, /\/api\/admin-ui/, 'client calls only admin-ui API');
});

test('admin shell uses WordPress-style navigation labels', () => {
  const shell = read('admin/src/layout/AdminShell.jsx');

  for (const label of ['Dashboard', 'Tin tức', 'Sản phẩm', 'Dự án', 'Dịch vụ', 'Trang chủ', 'Bảng giá', 'Liên hệ', 'Đơn đặt mẫu', 'Thư viện ảnh', 'Cài đặt website']) {
    assert.match(shell, new RegExp(label), `${label} navigation label exists`);
  }
});

test('admin resource config covers all full admin modules and field types', () => {
  const config = read('admin/src/config/resources.js');
  const listPage = read('admin/src/pages/ResourceListPage.jsx');
  const editPage = read('admin/src/pages/ResourceEditPage.jsx');
  const fieldRenderer = read('admin/src/components/FieldRenderer.jsx');

  for (const alias of ['news', 'products', 'projects', 'services', 'hero-slides', 'workflow-steps', 'pricing-packages', 'pricing-analyses', 'pricing-surveys', 'contact-inquiries', 'order-requests']) {
    assert.match(config, new RegExp(`['"]${alias}['"]`), `${alias} frontend config exists`);
  }

  for (const fieldType of ['richtext', 'cloudinary-image', 'key-value-table', 'text-list']) {
    assert.match(fieldRenderer, new RegExp(fieldType), `${fieldType} input is handled`);
  }

  assert.match(listPage, /publishResource/, 'list supports publish actions');
  assert.match(editPage, /saveResource/, 'edit page saves resources');
});

test('cloudinary-image fields capture the sibling public ID field on select', () => {
  const config = read('admin/src/config/resources.js');
  const editPage = read('admin/src/pages/ResourceEditPage.jsx');
  const fieldRenderer = read('admin/src/components/FieldRenderer.jsx');

  assert.match(
    config,
    /cloudinary_image_url:\s*{[^}]*publicIdField:\s*['"]cloudinary_public_id['"]/,
    'projects image field declares its sibling public ID field',
  );
  assert.match(editPage, /function setField/, 'edit page exposes a setField updater');
  assert.match(editPage, /setField=\{setField\}/, 'edit page passes setField down to FieldRenderer');
  assert.match(
    fieldRenderer,
    /field\.publicIdField[\s\S]{0,120}setField\(field\.publicIdField,\s*asset\.public_id\)/,
    'FieldRenderer writes the picked asset public_id into the configured sibling field',
  );
});

test('contact-inquiries and order-requests expose lead data as read-only fields', () => {
  const config = read('admin/src/config/resources.js');
  const fieldRenderer = read('admin/src/components/FieldRenderer.jsx');
  const configSource = read('dha-cms/src/api/admin-ui/services/resource-config.js');

  assert.match(configSource, /readFields:\s*\[[^\]]*email[^\]]*address[^\]]*message[^\]]*\]/, 'backend whitelists contact detail read fields');
  assert.match(configSource, /readFields:\s*\[[^\]]*product_uid[^\]]*email[^\]]*unit[^\]]*note[^\]]*\]/, 'backend whitelists order detail read fields');

  const contactMatch = config.match(/'contact-inquiries':\s*{[\s\S]*?fields:\s*{([\s\S]*?)}\s*},\n\s*'order-requests'/);
  assert.ok(contactMatch, 'contact-inquiries config block is present');
  for (const field of ['email', 'address', 'message']) {
    assert.match(contactMatch[1], new RegExp(`${field}:\\s*{[^}]*readOnly:\\s*true`), `contact-inquiries.${field} is read-only`);
  }

  const orderMatch = config.match(/'order-requests':\s*{[\s\S]*?fields:\s*{([\s\S]*?)}\s*},\n};/);
  assert.ok(orderMatch, 'order-requests config block is present');
  for (const field of ['product_uid', 'email', 'unit', 'note']) {
    assert.match(orderMatch[1], new RegExp(`${field}:\\s*{[^}]*readOnly:\\s*true`), `order-requests.${field} is read-only`);
  }

  assert.match(fieldRenderer, /field\.readOnly/, 'FieldRenderer honors a readOnly field flag');
});

test('admin media UI uploads through admin-ui and never stores Cloudinary secrets', () => {
  const mediaPage = read('admin/src/pages/MediaLibraryPage.jsx');
  const mediaApi = read('admin/src/api/media.js');
  const picker = read('admin/src/components/ImagePicker.jsx');

  assert.match(mediaApi, /\/media\/upload/, 'media upload goes through the backend endpoint');
  assert.match(mediaApi, /FormData/, 'media upload uses multipart FormData');
  assert.match(picker, /onSelect/, 'image picker returns selected media');
  assert.doesNotMatch(
    mediaPage + mediaApi + picker,
    /CLOUDINARY_API_SECRET|api_secret|cloudinary\.config/,
    'frontend has no Cloudinary secrets',
  );
});

// ImagePicker is rendered by FieldRenderer inside the <form className="edit-form">
// of ResourceEditPage/HomePageEditor/SettingsPage. Nested <form> elements are
// invalid HTML — the browser drops the inner one, which makes any type="submit"
// button inside the picker submit the *outer* edit form: the page reloads and
// the upload never fires. The picker must therefore drive its upload from a
// plain button click, not from a form submit.
test('image picker uploads without a nested form that would submit the edit form', () => {
  const picker = read('admin/src/components/ImagePicker.jsx');
  const editPage = read('admin/src/pages/ResourceEditPage.jsx');

  assert.match(editPage, /<form className="edit-form"/, 'edit page wraps fields in a form');
  assert.doesNotMatch(picker, /<form/, 'image picker renders no nested form');
  assert.doesNotMatch(picker, /type="submit"/, 'image picker upload button never submits a form');
  assert.match(picker, /onClick={handleUpload}/, 'image picker uploads on click');
});

test('image picker offers upload upfront and can reuse pre-rebrand images', () => {
  const picker = read('admin/src/components/ImagePicker.jsx');
  const mediaApi = read('admin/src/api/media.js');

  // The upload row sits outside the collapsible library panel, so editors can
  // add an image without opening the library first.
  const panel = picker.split('{open ?')[1] || '';
  assert.match(picker, /image-picker-upload/, 'upload row exists');
  assert.doesNotMatch(panel, /image-picker-upload/, 'upload row is not hidden inside the library panel');

  assert.match(mediaApi, /export function getLegacyFolder/, 'legacy folder mapping is shared from the media api');
  assert.match(picker, /getLegacyFolder/, 'picker also lists the pre-rebrand folder');
});

test('admin has grouped homepage pricing and settings screens', () => {
  const app = read('admin/src/App.jsx');
  const home = read('admin/src/pages/HomePageEditor.jsx');
  const pricing = read('admin/src/pages/PricingPage.jsx');
  const settings = read('admin/src/pages/SettingsPage.jsx');

  assert.match(app, /\/home/, 'homepage editor route exists');
  assert.match(app, /\/pricing/, 'pricing route exists');
  assert.match(app, /\/settings/, 'settings route exists');
  assert.match(home, /hero-slides/, 'home editor manages hero slides');
  assert.match(home, /workflow-steps/, 'home editor manages workflow steps');
  assert.match(home, /site-setting/, 'home editor manages site-setting hero fields');
  assert.match(pricing, /pricing-packages/, 'pricing page manages market prices');
  assert.match(pricing, /pricing-analyses/, 'pricing page manages analysis prices');
  assert.match(pricing, /pricing-surveys/, 'pricing page manages survey prices');
  assert.match(settings, /hotline/, 'settings page manages contact fields');
});
