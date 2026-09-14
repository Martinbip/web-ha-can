'use strict';

// Sản phẩm giữ danh mục dưới dạng mảng mã (slug) chứ không phải quan hệ, nên
// đổi mã hay xoá danh mục sẽ để lại mã mồ côi trong sản phẩm — biểu hiện ra
// ngoài là sản phẩm biến mất khỏi mọi tab mà không rõ vì sao. Hai hook dưới đây
// dọn theo ngay khi danh mục thay đổi.
const { getStore } = require('../sanity/store-registry');

const PRODUCT_TYPE = 'product';
const MAX_PRODUCTS = 10000;

async function rewriteProductCategories(mapSlugs) {
  const products = getStore().documents(PRODUCT_TYPE);
  const rows = await products.findMany({ fields: ['categories'], limit: MAX_PRODUCTS });
  // Gom hết bản sửa trước rồi ghi một lần: đổi mã danh mục dùng bởi K sản
  // phẩm trước đây là K lần commit + K lần nạp lại cache toàn bộ type
  // `product` (~500 document) — đủ vượt timeout 60s của nginx và bỏ dở giữa
  // chừng. patchMany ghi cả K bản trong MỘT transaction, xoá cache một lần.
  const changes = [];
  for (const product of rows) {
    const current = Array.isArray(product.categories) ? product.categories : [];
    if (!current.length) continue;
    const next = mapSlugs(current);
    if (next.length === current.length && next.every((slug, i) => slug === current[i])) continue;
    changes.push({ documentId: product.documentId, data: { categories: next } });
  }
  if (changes.length) await products.patchMany(changes);
}

module.exports = {
  // Cần đọc mã cũ trước khi ghi đè thì mới biết mã nào phải thay.
  needsSnapshot: true,

  async afterUpdate(before, after) {
    const oldSlug = before && before.slug;
    const newSlug = after && after.slug;
    if (!oldSlug || !newSlug || oldSlug === newSlug) return;
    await rewriteProductCategories((slugs) =>
      [...new Set(slugs.map((slug) => (slug === oldSlug ? newSlug : slug)))],
    );
  },

  async afterDelete(before) {
    const removedSlug = before && before.slug;
    if (!removedSlug) return;
    await rewriteProductCategories((slugs) => slugs.filter((slug) => slug !== removedSlug));
  },
};
