const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const {
  DEFAULT_CATEGORIES,
  guessCategories,
} = require('../dha-cms/src/api/product-category/default-categories');
const { getResourceConfig } = require('../dha-api/src/services/resource-config');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function readJson(file) {
  return JSON.parse(read(file));
}

test('danh mục sản phẩm là một collection thật trong CMS', () => {
  const schema = readJson('dha-cms/src/api/product-category/content-types/product-category/schema.json');
  assert.equal(schema.collectionName, 'product_categories');
  for (const field of ['slug', 'name', 'visible', 'sort_order']) {
    assert.ok(schema.attributes[field], `${field} có trong schema`);
  }
  assert.equal(schema.attributes.slug.unique, true, 'mã danh mục không được trùng');

  const productSchema = readJson('dha-cms/src/api/product/content-types/product/schema.json');
  assert.equal(productSchema.attributes.categories.type, 'json', 'sản phẩm giữ mảng mã danh mục');
});

test('website đọc được danh mục mà không cần đăng nhập', () => {
  const bootstrap = read('dha-cms/src/index.js');
  assert.match(bootstrap, /api::product-category\.product-category\.find'/);
  assert.match(bootstrap, /api::product-category\.product-category\.findOne'/);
});

test('danh mục mặc định nằm trong code, không nằm ở data/', () => {
  // data/ không được deploy sang máy chủ Strapi, seed đọc từ đó sẽ hỏng.
  const source = read('dha-cms/src/api/product-category/default-categories.js');
  assert.doesNotMatch(source, /loadJsonFile|\.\.\/\.\.\/data/);
  assert.equal(DEFAULT_CATEGORIES.length, 3);
  assert.deepEqual(
    DEFAULT_CATEGORIES.map((category) => category.slug),
    ['color-metal', 'black-metal', 'rare-earth'],
  );
});

test('sản phẩm cũ được đoán danh mục đúng bằng luật lọc trước đây', () => {
  assert.deepEqual(guessCategories({ uid: 'dong-cathode', group: 'dong' }), ['color-metal']);
  assert.deepEqual(guessCategories({ uid: 'quang-dong-tho', group: 'quang' }), ['color-metal']);
  assert.deepEqual(guessCategories({ uid: 'quang-sat-tho', group: 'quang' }), ['black-metal']);
  assert.deepEqual(guessCategories({ uid: 'x', name: 'Quặng Đất Hiếm', group: 'quang' }), ['rare-earth']);
  assert.deepEqual(guessCategories({ uid: 'khac', group: 'quang' }), []);
});

test('mọi sản phẩm dự phòng trong data/ đều đã có danh mục', () => {
  const products = readJson('data/products.json');
  for (const product of products) {
    assert.ok(Array.isArray(product.categories), `${product.uid} có trường categories`);
  }
  const categories = readJson('data/product_categories.json');
  const known = new Set(categories.map((category) => category.slug));
  for (const product of products) {
    for (const slug of product.categories) {
      assert.ok(known.has(slug), `${product.uid} trỏ tới danh mục có thật: ${slug}`);
    }
  }
});

test('admin quản lý được danh mục và gán danh mục cho sản phẩm', () => {
  const config = getResourceConfig('product-categories');
  assert.equal(config.sanityType, 'productCategory');
  assert.deepEqual(config.editableFields, ['name', 'slug', 'visible', 'sort_order']);

  const products = getResourceConfig('products');
  assert.ok(products.editableFields.includes('categories'), 'sửa được danh mục của sản phẩm');
  assert.equal(products.fields.categories.type, 'multi-select');
  assert.equal(products.fields.categories.optionsFrom, 'product-categories');

  const adminConfig = read('admin/src/config/resources.js');
  assert.match(adminConfig, /'product-categories'/);
  assert.match(adminConfig, /optionsFrom: 'product-categories'/);
  assert.match(read('admin/src/layout/AdminShell.jsx'), /\/resources\/product-categories/);
  assert.match(read('admin/src/components/FieldRenderer.jsx'), /case 'multi-select'/);
});

test('đổi mã hoặc xoá danh mục thì sản phẩm được dọn theo', () => {
  const hook = read('dha-api/src/hooks/product-category.js');
  assert.match(hook, /afterUpdate/);
  assert.match(hook, /afterDelete/);
  assert.match(hook, /PRODUCT_TYPE = 'product'/);
});

test('trang chủ và trang sản phẩm dựng tab từ CMS, không viết cứng', () => {
  const appJs = read('app.js');
  assert.match(appJs, /product-categories\?sort=sort_order:asc/);
  assert.match(appJs, /function productMatchesCategory/);
  assert.match(appJs, /renderCategoryTabs\(tabsContainer/);

  // Luật đoán theo tên là nguyên nhân tab luôn hiện 0 sản phẩm — việc lọc không
  // được quay lại cách đó. (Nhãn màu trên ảnh vẫn dùng `group`, đó là chỗ khác.)
  assert.doesNotMatch(appJs, /const isBlackMetal = \(p\) =>/);
  assert.doesNotMatch(appJs, /filter === 'black-metal'/);
  assert.doesNotMatch(appJs, /hcount-/);

  for (const file of ['index.html', 'products.html']) {
    const html = read(file);
    assert.doesNotMatch(html, /data-filter="black-metal"/, `${file} không viết cứng tab`);
    assert.doesNotMatch(html, /data-filter="rare-earth"/, `${file} không viết cứng tab`);
    assert.match(html, /data-filter="all"/, `${file} giữ nút Tất Cả`);
  }
});

// Hook chạy sau khi admin sửa/xoá danh mục (dha-api/src/hooks). Test dựng store
// giả với vài sản phẩm, gọi thẳng hook rồi xem sản phẩm được viết lại ra sao.
const { setStore } = require('../dha-api/src/sanity/store-registry');
const { createFakeStore } = require('./helpers/admin-ui-harness');
const categoryHooks = require('../dha-api/src/hooks/product-category');

function useProducts(products) {
  const fake = createFakeStore({ product: products });
  setStore(fake);
  return fake;
}

test('đổi mã danh mục thì sản phẩm đã gán đi theo mã mới', async () => {
  const fake = useProducts([
    { documentId: 'p1', categories: ['color-metal'] },
    { documentId: 'p2', categories: ['color-metal', 'black-metal'] },
    { documentId: 'p3', categories: [] },
  ]);

  await categoryHooks.afterUpdate({ slug: 'color-metal' }, { slug: 'kim-loai-mau' });

  const rows = fake.__rows('product');
  assert.deepEqual(rows[0].categories, ['kim-loai-mau']);
  assert.deepEqual(rows[1].categories, ['kim-loai-mau', 'black-metal']);
  assert.equal(fake.__calls.filter((call) => call.method === 'update').length, 2, 'sản phẩm không liên quan thì không bị ghi lại');
  setStore(null);
});

test('xoá danh mục thì mã của nó được gỡ khỏi sản phẩm', async () => {
  const fake = useProducts([
    { documentId: 'p1', categories: ['color-metal', 'rare-earth'] },
    { documentId: 'p2', categories: ['black-metal'] },
  ]);

  await categoryHooks.afterDelete({ slug: 'rare-earth' });

  const rows = fake.__rows('product');
  assert.deepEqual(rows[0].categories, ['color-metal']);
  assert.deepEqual(rows[1].categories, ['black-metal']);
  setStore(null);
});
