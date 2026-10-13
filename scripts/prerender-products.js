// Ghi mỗi sản phẩm thành một trang tĩnh /san-pham/<mã>/index.html.
//
// Như tin tức (xem prerender-articles.js): product-detail.html chỉ điền tiêu
// đề, mô tả, ảnh bằng JavaScript, nên Google lần đầu và Facebook/Zalo thấy
// trang nào cũng là "Chi Tiết Sản Phẩm". Trang tĩnh mang sẵn các thẻ đó cùng
// dữ liệu cấu trúc Product; phần thân vẫn do app.js dựng.
//
// Thư mục san-pham/ trong thư mục phục vụ thuộc hẳn về bước này: sản phẩm bị
// xoá hay đổi mã thì thư mục cũ bị dọn đi.
const {
  SITE,
  escapeAttr,
  escapeText,
  absoluteUrl,
  replaceTagById,
  isSafeSlug,
  writeArticlePages,
} = require('./prerender-articles');

const PRODUCT_DIR = 'san-pham';
const SITE_NAME = 'DHA Minerals';
const BRAND = 'Kim Loại Màu DHA';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function productPath(uid) {
  return `/${PRODUCT_DIR}/${encodeURIComponent(uid)}`;
}

// Phải khớp với truncateMetaText() trong app.js.
function truncateMetaText(value, limit = 160) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

// Phải khớp với productMeta() trong app.js.
function productMeta(product) {
  return {
    title: text(product.seo_title) || `${text(product.name)} - ${SITE_NAME}`,
    description: text(product.seo_description) || truncateMetaText(product.description),
    image: absoluteUrl(product.image),
    url: `${SITE}${productPath(product.uid)}`,
  };
}

// Giá theo kg/tấn: Google cần con số và đơn vị tiền; đơn vị khối lượng đi vào
// unitText. Sản phẩm "giá liên hệ" không có offers — đúng thực tế là chưa niêm yết.
function productOffer(product) {
  const price = Number(product.price);
  if (product.price_on_request || !Number.isFinite(price) || price <= 0) return undefined;
  const unit = text(product.price_unit).replace(/^đ\s*\/\s*/i, '') || 'kg';
  return {
    '@type': 'Offer',
    price: String(price),
    priceCurrency: 'VND',
    availability: product.in_stock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    url: `${SITE}${productPath(product.uid)}`,
    priceSpecification: { '@type': 'UnitPriceSpecification', price: String(price), priceCurrency: 'VND', unitText: unit },
  };
}

function productJsonLd(product, meta) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: text(product.name),
    description: text(product.description) || meta.description || undefined,
    image: meta.image ? [meta.image] : undefined,
    sku: text(product.uid),
    brand: { '@type': 'Brand', name: BRAND },
    offers: productOffer(product),
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function applyProductToHtml(html, product) {
  const meta = productMeta(product);
  let out = html;
  out = replaceTagById(out, 'title', 'page-title', `<title id="page-title">${escapeText(meta.title)}</title>`);
  out = replaceTagById(out, 'meta', 'page-desc', `<meta name="description" id="page-desc" content="${escapeAttr(meta.description)}">`);
  out = replaceTagById(out, 'meta', 'og-title', `<meta property="og:title" id="og-title" content="${escapeAttr(meta.title)}">`);
  out = replaceTagById(out, 'meta', 'og-desc', `<meta property="og:description" id="og-desc" content="${escapeAttr(meta.description)}">`);
  out = replaceTagById(out, 'meta', 'og-image', `<meta property="og:image" id="og-image" content="${escapeAttr(meta.image)}">`);
  out = replaceTagById(out, 'meta', 'og-url', `<meta property="og:url" id="og-url" content="${escapeAttr(meta.url)}">`);
  out = replaceTagById(out, 'link', 'canonical-url', `<link rel="canonical" id="canonical-url" href="${escapeAttr(meta.url)}">`);
  const jsonLd = `<script type="application/ld+json" id="product-jsonld">${productJsonLd(product, meta)}</script>`;
  return out.replace(/<\/head>/i, `    ${jsonLd}\n</head>`);
}

function buildProductPages(templateHtml, products) {
  const pages = {};
  for (const product of products || []) {
    if (product && isSafeSlug(product.uid)) pages[product.uid] = applyProductToHtml(templateHtml, product);
  }
  return pages;
}

function writeProductPages(target, pages) {
  return writeArticlePages(target, pages, PRODUCT_DIR);
}

module.exports = {
  PRODUCT_DIR,
  productMeta,
  productPath,
  truncateMetaText,
  applyProductToHtml,
  buildProductPages,
  writeProductPages,
};
