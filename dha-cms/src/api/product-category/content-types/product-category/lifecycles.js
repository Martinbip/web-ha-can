'use strict';

// Sản phẩm giữ danh mục dưới dạng mảng mã (slug) chứ không phải quan hệ, nên
// đổi mã hay xoá danh mục sẽ để lại mã mồ côi trong sản phẩm — biểu hiện ra
// ngoài là sản phẩm biến mất khỏi mọi tab mà không rõ vì sao. Hai hook dưới đây
// dọn theo ngay khi danh mục thay đổi.
const PRODUCT_UID = 'api::product.product';
const CATEGORY_UID = 'api::product-category.product-category';

// Danh mục hiện ở tab lọc, khối bên hông trang chủ và chân trang mọi trang — tất
// cả được prerender ghi sẵn vào HTML tĩnh. Lưu xong là ghi lại, không đợi deploy.
// Gọi qua đối tượng module (không destructure) để test thay được hàm này.
const prerender = require('../../../site-setting/prerender');

const slugBeforeUpdate = new Map();

async function loadProducts() {
  return strapi.db.query(PRODUCT_UID).findMany({ limit: 500 });
}

async function rewriteProductCategories(mapSlugs) {
  const products = await loadProducts();
  for (const product of products) {
    const current = Array.isArray(product.categories) ? product.categories : [];
    if (!current.length) continue;
    const next = mapSlugs(current);
    if (next.length === current.length && next.every((slug, i) => slug === current[i])) continue;
    await strapi.db.query(PRODUCT_UID).update({
      where: { id: product.id },
      data: { categories: next },
    });
  }
}

module.exports = {
  afterCreate() {
    prerender.schedulePrerender();
  },

  async beforeUpdate(event) {
    const id = event.params?.where?.id;
    if (!id) return;
    const existing = await strapi.db.query(CATEGORY_UID).findOne({ where: { id } });
    if (existing?.slug) slugBeforeUpdate.set(id, existing.slug);
  },

  async afterUpdate(event) {
    const id = event.params?.where?.id;
    const oldSlug = slugBeforeUpdate.get(id);
    slugBeforeUpdate.delete(id);
    const newSlug = event.result?.slug;

    if (oldSlug && newSlug && oldSlug !== newSlug) {
      await rewriteProductCategories((slugs) =>
        [...new Set(slugs.map((slug) => (slug === oldSlug ? newSlug : slug)))],
      );
    }
    prerender.schedulePrerender();
  },

  async afterDelete(event) {
    const removedSlug = event.result?.slug;
    if (removedSlug) {
      await rewriteProductCategories((slugs) => slugs.filter((slug) => slug !== removedSlug));
    }
    prerender.schedulePrerender();
  },
};
