// Ghi mỗi bài tin tức đã đăng thành một trang tĩnh /tin-tuc/<slug>/index.html.
//
// Vì sao cần: news-detail.html chỉ điền tiêu đề, mô tả, ảnh của bài bằng
// JavaScript, mà Facebook, Zalo và phần lớn trình đọc link khác không chạy JS —
// chia sẻ bài nào cũng ra cùng một tiêu đề chung chung, không ảnh. Trang tĩnh
// mang sẵn các thẻ đó. Phần thân bài vẫn do app.js dựng như cũ (một bộ lọc HTML
// duy nhất), nên ở đây chỉ đụng tới <head>.
//
// Đường dẫn cũ của bài (old_slugs, server ghi khi bài đã đăng bị đổi đường dẫn)
// được ghi thành trang chuyển hướng tức thì — Google coi meta refresh 0 giây là
// chuyển hướng vĩnh viễn, nên link cũ không chết và không mất thứ hạng.
//
// Thư mục tin-tuc/ trong thư mục phục vụ thuộc hẳn về bước này: bài bị xoá, gỡ
// đăng hay đổi đường dẫn thì thư mục cũ của nó bị dọn đi.
const fs = require('node:fs');
const path = require('node:path');

const SITE = process.env.SITE_URL || 'https://dhakimloaimau.vn';
const ARTICLE_DIR = 'tin-tuc';
const SITE_NAME = 'DHA Minerals';
const PUBLISHER_NAME = 'Kim Loại Màu DHA';

// Strapi kiểu uid chỉ nhận đúng bộ ký tự này — kiểm lại vẫn cần, vì slug trở
// thành tên thư mục: "..", "/" mà lọt vào là ghi ra ngoài thư mục phục vụ.
const SAFE_SLUG = /^[A-Za-z0-9._~-]+$/;

function isSafeSlug(slug) {
  const value = String(slug || '');
  return SAFE_SLUG.test(value) && value !== '.' && value !== '..';
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function absoluteUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${SITE}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function articlePath(slug) {
  return `/${ARTICLE_DIR}/${encodeURIComponent(slug)}`;
}

// Bài không có ảnh đại diện vẫn nên có ảnh khi chia sẻ: lấy ảnh đầu tiên trong
// bài (chỉ địa chỉ http(s) — đúng thứ bộ lọc bài viết cho hiện).
function firstContentImage(content) {
  const match = String(content || '').match(/<img\b[^>]*\bsrc="(https?:\/\/[^"]+)"/i);
  return match ? match[1].replace(/&amp;/g, '&') : '';
}

// Phải khớp với articleMeta() trong app.js: trang tĩnh và trang sau khi JS chạy
// phải nói cùng một tiêu đề, mô tả, ảnh.
function articleMeta(article) {
  const title = text(article.title);
  return {
    title: text(article.seo_title) || `${title} - ${SITE_NAME}`,
    description: text(article.seo_description) || text(article.summary),
    image: absoluteUrl(article.share_image) || absoluteUrl(article.image) || absoluteUrl(firstContentImage(article.content)),
    url: `${SITE}${articlePath(article.slug)}`,
  };
}

function articleJsonLd(article, meta) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: text(article.title).slice(0, 110),
    description: meta.description || undefined,
    image: meta.image ? [meta.image] : undefined,
    datePublished: text(article.date) || undefined,
    dateModified: text(article.updatedAt) || text(article.date) || undefined,
    mainEntityOfPage: meta.url,
    publisher: { '@type': 'Organization', name: PUBLISHER_NAME, url: SITE },
  };
  // "</script>" trong tiêu đề sẽ đóng thẻ script giữa chừng — escape dấu "<".
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function replaceTagById(html, tag, id, replacement) {
  const re = new RegExp(`<${tag}\\b[^>]*\\bid="${id}"[^>]*>(?:[\\s\\S]*?</${tag}>)?`, 'i');
  return html.replace(re, replacement);
}

function applyArticleToHtml(html, article) {
  const meta = articleMeta(article);
  let out = html;
  out = replaceTagById(out, 'title', 'page-title', `<title id="page-title">${escapeText(meta.title)}</title>`);
  out = replaceTagById(out, 'meta', 'page-desc', `<meta name="description" id="page-desc" content="${escapeAttr(meta.description)}">`);
  out = replaceTagById(out, 'meta', 'og-title', `<meta property="og:title" id="og-title" content="${escapeAttr(meta.title)}">`);
  out = replaceTagById(out, 'meta', 'og-desc', `<meta property="og:description" id="og-desc" content="${escapeAttr(meta.description)}">`);
  out = replaceTagById(out, 'meta', 'og-image', `<meta property="og:image" id="og-image" content="${escapeAttr(meta.image)}">`);
  out = replaceTagById(out, 'meta', 'og-url', `<meta property="og:url" id="og-url" content="${escapeAttr(meta.url)}">`);
  out = replaceTagById(out, 'link', 'canonical-url', `<link rel="canonical" id="canonical-url" href="${escapeAttr(meta.url)}">`);
  const jsonLd = `<script type="application/ld+json" id="article-jsonld">${articleJsonLd(article, meta)}</script>`;
  return out.replace(/<\/head>/i, `    ${jsonLd}\n</head>`);
}

function renderRedirectHtml(slug) {
  const target = articlePath(slug);
  const url = `${SITE}${target}`;
  return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Bài viết đã chuyển địa chỉ - ${SITE_NAME}</title>
    <link rel="canonical" href="${escapeAttr(url)}">
    <meta http-equiv="refresh" content="0; url=${escapeAttr(target)}">
    <script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')});</script>
</head>
<body>
    <p>Bài viết đã chuyển sang <a href="${escapeAttr(target)}">địa chỉ mới</a>.</p>
</body>
</html>
`;
}

// Trả về { [slug]: html } cho mọi trang cần có trong tin-tuc/. Bài đã đăng luôn
// thắng đường dẫn cũ của bài khác nếu trùng nhau.
function buildArticlePages(templateHtml, articles) {
  const pages = {};
  const list = (articles || []).filter((article) => article && isSafeSlug(article.slug));

  for (const article of list) {
    const oldSlugs = Array.isArray(article.old_slugs) ? article.old_slugs : [];
    for (const old of oldSlugs) {
      if (isSafeSlug(old) && old !== article.slug) pages[old] = renderRedirectHtml(article.slug);
    }
  }
  for (const article of list) {
    pages[article.slug] = applyArticleToHtml(templateHtml, article);
  }
  return pages;
}

// Ghi mỗi trang vào <dir>/<slug>/index.html và dọn thư mục con không còn trong
// danh sách. Dùng chung cho tin tức (tin-tuc/) và sản phẩm (san-pham/).
function writeArticlePages(target, pages, dir = ARTICLE_DIR) {
  const root = path.join(target, dir);
  fs.mkdirSync(root, { recursive: true });
  let changed = 0;

  for (const [slug, html] of Object.entries(pages)) {
    const pageDir = path.join(root, slug);
    const file = path.join(pageDir, 'index.html');
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current === html) continue;
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(file, html, 'utf8');
    changed += 1;
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !Object.prototype.hasOwnProperty.call(pages, entry.name)) {
      fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
      changed += 1;
    }
  }
  return changed;
}

module.exports = {
  SITE,
  ARTICLE_DIR,
  escapeAttr,
  escapeText,
  absoluteUrl,
  replaceTagById,
  isSafeSlug,
  articleMeta,
  applyArticleToHtml,
  renderRedirectHtml,
  buildArticlePages,
  writeArticlePages,
};
