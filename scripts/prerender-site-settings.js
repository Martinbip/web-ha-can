#!/usr/bin/env node
// Ghi cài đặt website, danh mục sản phẩm và menu của CMS thẳng vào các file HTML tĩnh.
//
//   node scripts/prerender-site-settings.js [thư/mục/html]
//
// Vì sao cần: HTML trong repo chứa nội dung mẫu (hotline, địa chỉ, câu chữ), còn
// nội dung thật chỉ về sau khi app.js gọi CMS xong — nên khách vào lần đầu thấy
// nội dung mẫu chớp qua một nhịp. app.js đã cất bộ nhớ đệm cho những lần sau;
// bước này lo nốt lần đầu tiên.
//
// Chạy trên VPS lúc deploy, đọc Strapi qua localhost và ghi vào thư mục nginx
// phục vụ — không ghi vào repo, để git tree luôn sạch (giống generate-sitemap).
//
// Ngoài tầm với: ảnh logo và favicon do quản trị tải lên vẫn áp bằng JS — ảnh
// dù sao cũng phải tải về mới hiện được.
const fs = require('node:fs');
const path = require('node:path');

const CMS = process.env.CMS_URL || 'http://127.0.0.1:1337';

// Thẻ tự đóng không có phần nội dung để mà thay.
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// Chỉ escape đúng ba ký tự mà trình duyệt escape khi in text ra HTML — thêm nữa
// (dấu nháy chẳng hạn) là HTML tĩnh lệch với thứ app.js dựng, tức lại chớp.
function escapeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, '&quot;');
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;
  while ((match = re.exec(raw))) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function classList(attrs) {
  return String(attrs.class || '').split(/\s+/).filter(Boolean);
}

function setAttr(raw, name, value) {
  const re = new RegExp(`(\\s${name})(\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'>]+))?`, 'i');
  const written = value === true ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`;
  return re.test(raw) ? raw.replace(re, written) : `${raw}${written}`;
}

function removeAttr(raw, name) {
  return raw.replace(new RegExp(`\\s${name}(\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'>]+))?`, 'i'), '');
}

// Tìm vị trí thẻ đóng của phần tử mở tại openEnd, đếm cân bằng thẻ cùng tên để
// không dừng nhầm ở thẻ con.
function findCloseIndex(html, tagName, openEnd) {
  const re = new RegExp(`<(/?)${tagName}\\b`, 'gi');
  re.lastIndex = openEnd;
  let depth = 1;
  let match;
  while ((match = re.exec(html))) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return match.index;
  }
  return -1;
}

// Duyệt mọi thẻ mở một lượt; handler đầu tiên nhận việc được quyền sửa thuộc
// tính và nội dung của phần tử đó.
function transformHtml(html, handlers) {
  const edits = [];
  const openTag = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let match;

  while ((match = openTag.exec(html))) {
    const [full, tagName, rawAttrs] = match;
    const isVoid = VOID_TAGS.has(tagName.toLowerCase()) || rawAttrs.endsWith('/');

    const attrs = parseAttrs(rawAttrs);
    const handler = handlers.find((each) => each.match(tagName.toLowerCase(), attrs));
    if (!handler) continue;

    // Thẻ tự đóng (vd <meta>) không có phần nội dung để đóng — chỉ thuộc tính
    // có thể sửa, xong việc luôn tại đây, không dò tiếp thẻ đóng.
    if (isVoid) {
      const result = handler.apply({ tagName, attrs, rawAttrs, inner: '' });
      if (result?.rawAttrs != null && result.rawAttrs !== rawAttrs) {
        edits.push({ start: match.index, end: match.index + full.length, html: `<${tagName}${result.rawAttrs}>` });
      }
      continue;
    }

    const openEnd = match.index + full.length;
    const closeIndex = findCloseIndex(html, tagName, openEnd);
    if (closeIndex < 0) continue;

    const inner = html.slice(openEnd, closeIndex);
    const result = handler.apply({ tagName, attrs, rawAttrs, inner });
    if (!result) continue;

    // Thẻ mở và phần nội dung sửa tách rời nhau: một thẻ <a href="tel:"> có thể
    // bọc đúng cái <span class="site-hotline"> mà ta cũng phải thay: gộp chung
    // thành một mảnh thì mảnh ngoài ghi đè mất mảnh trong.
    if (result.rawAttrs != null && result.rawAttrs !== rawAttrs) {
      edits.push({ start: match.index, end: openEnd, html: `<${tagName}${result.rawAttrs}>` });
    }
    if (result.inner != null && result.inner !== inner) {
      edits.push({ start: openEnd, end: closeIndex, html: result.inner, replacesInner: true });
    }
  }

  // Áp từ cuối lên đầu để các vị trí đã tìm được không bị xê dịch. Nội dung nằm
  // lồng trong một phần đã bị thay thì bỏ qua — nó không còn tồn tại nữa.
  const innerEdits = edits.filter((edit) => edit.replacesInner);
  let out = html;
  for (const edit of edits.sort((a, b) => a.start - b.start).reverse()) {
    const swallowed = innerEdits.some(
      (other) => other !== edit && other.start <= edit.start && edit.end <= other.end,
    );
    if (swallowed) continue;
    out = out.slice(0, edit.start) + edit.html + out.slice(edit.end);
  }
  return out;
}

function text(settings, key) {
  const value = String(settings[key] ?? '').trim();
  return value || null;
}

// Cùng quy tắc với safeNavUrl() trong app.js và normalizeUrl() trong
// dha-cms/src/api/admin-ui/services/navigation.js: chỉ nhận đường dẫn nội bộ,
// neo trong trang hoặc http(s) — chặn javascript:, data:... do CMS gửi xuống.
// "//vi-du.vn" và "/\vi-du.vn" trông như đường dẫn trong website nhưng trình
// duyệt hiểu là một tên miền khác nên bị loại riêng.
function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\/[/\\]/.test(raw)) return '';
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;
  if (/^https?:\/\/\S+$/i.test(raw)) return raw;
  return '';
}

// Phải cho ra cùng một DOM với renderFooterLinks() trong app.js.
function renderFooterLinks(items) {
  if (!Array.isArray(items)) return '';
  return items
    .filter((item) => item && item.visible !== false && String(item.label ?? '').trim() && safeUrl(item.url))
    .map((item) => `<li><a href="${escapeAttr(safeUrl(item.url))}">${escapeText(item.label)}</a></li>`)
    .join('');
}

function applySettingsToHtml(html, settings, { year = new Date().getFullYear() } = {}) {
  const hotline = text(settings, 'hotline');
  const hotlineClean = hotline ? hotline.replace(/[.\s\-()]/g, '') : null;
  const email = text(settings, 'email');
  const taxCode = text(settings, 'tax_code');

  // Cùng danh sách và cùng thứ tự ưu tiên với SOCIAL_LINKS trong app.js.
  const socialUrls = {
    Facebook: text(settings, 'facebook_url'),
    YouTube: text(settings, 'youtube_url'),
    'Twitter/X': text(settings, 'twitter_url'),
    Zalo: text(settings, 'zalo_url') || (hotlineClean ? `https://zalo.me/${hotlineClean}` : null),
  };

  // Ba ô số liệu ở hero lấy theo thứ tự xuất hiện, đúng như app.js đọc stats[0..2].
  let statNumber = 0;
  let statLabel = 0;

  const byClass = (name) => (tagName, attrs) => classList(attrs).includes(name);
  const swapText = (key) => ({ }) => {
    const value = text(settings, key);
    return value ? { inner: escapeText(value) } : null;
  };

  const handlers = [
    {
      match: (tagName, attrs) => classList(attrs).includes('site-hotline'),
      apply: ({ rawAttrs }) =>
        hotline
          ? {
              inner: escapeText(hotline),
              rawAttrs: 'href' in parseAttrs(rawAttrs) ? setAttr(rawAttrs, 'href', `tel:${hotlineClean}`) : rawAttrs,
            }
          : null,
    },
    {
      // app.js đổi mọi link gọi điện sang số trong CMS, không riêng .site-hotline.
      match: (tagName, attrs) => tagName === 'a' && String(attrs.href || '').startsWith('tel:'),
      apply: ({ rawAttrs }) => (hotlineClean ? { rawAttrs: setAttr(rawAttrs, 'href', `tel:${hotlineClean}`) } : null),
    },
    {
      match: (tagName, attrs) => classList(attrs).includes('site-email'),
      apply: ({ tagName, rawAttrs }) =>
        email
          ? {
              inner: escapeText(email),
              rawAttrs: tagName === 'a' ? setAttr(rawAttrs, 'href', `mailto:${email}`) : rawAttrs,
            }
          : null,
    },
    {
      match: (tagName, attrs) => classList(attrs).includes('site-tax-code'),
      apply: () => (taxCode ? { inner: escapeText(`MST: ${taxCode} do Sở KH&ĐT TP. Hà Nội cấp.`) } : null),
    },
    { match: byClass('site-address'), apply: swapText('address') },
    { match: byClass('site-office-name'), apply: swapText('office_name') },
    { match: byClass('site-brand-bio'), apply: swapText('brand_bio') },
    { match: byClass('logo-accent'), apply: swapText('logo_text_accent') },
    { match: byClass('logo-text'), apply: swapText('logo_text_main') },
    { match: byClass('hero-tagline'), apply: swapText('hero_tagline') },
    { match: byClass('hero-description'), apply: swapText('hero_description') },
    { match: byClass('spec-badge-label'), apply: swapText('hero_cert_label') },
    { match: byClass('spec-badge-value'), apply: swapText('hero_cert_value') },
    {
      match: byClass('hero-title'),
      apply: () => {
        const value = text(settings, 'hero_title');
        return value ? { inner: escapeText(value).replace(/\n/g, '<br>') } : null;
      },
    },
    {
      match: byClass('stat-number'),
      apply: () => {
        const value = text(settings, `stat${++statNumber}_number`);
        return value ? { inner: escapeText(value) } : null;
      },
    },
    {
      match: byClass('stat-label'),
      apply: () => {
        // app.js chỉ ghi nhãn khi ô đó có số — thiếu số thì nhãn giữ nguyên.
        const index = ++statLabel;
        if (!text(settings, `stat${index}_number`)) return null;
        return { inner: escapeText(settings[`stat${index}_label`] || '') };
      },
    },
    {
      match: (tagName, attrs) => tagName === 'a' && attrs['aria-label'] in socialUrls,
      apply: ({ attrs, rawAttrs }) => {
        const url = socialUrls[attrs['aria-label']];
        return { rawAttrs: url ? removeAttr(setAttr(rawAttrs, 'href', url), 'hidden') : setAttr(rawAttrs, 'hidden', true) };
      },
    },
    {
      // Nút đầu trang: chữ qua data-site-text, link qua header_cta_url. Một
      // handler lo cả hai vì mỗi phần tử chỉ được một handler nhận.
      match: byClass('btn-contact'),
      apply: ({ attrs, rawAttrs }) => {
        const label = 'data-site-text' in attrs ? text(settings, attrs['data-site-text']) : null;
        const url = safeUrl(settings.header_cta_url);
        if (!label && !url) return null;
        return {
          ...(label ? { inner: escapeText(label) } : {}),
          ...(url ? { rawAttrs: setAttr(rawAttrs, 'href', url) } : {}),
        };
      },
    },
    {
      match: (tagName, attrs) => 'data-footer-links' in attrs,
      apply: () => {
        const links = renderFooterLinks(settings.footer_links);
        return links ? { inner: links } : null;
      },
    },
    {
      match: (tagName, attrs) => 'data-copyright' in attrs,
      apply: () => {
        const value = text(settings, 'copyright_text');
        return value ? { inner: escapeText(`© ${year} ${value}`) } : null;
      },
    },
    {
      match: (tagName, attrs) => 'data-site-text' in attrs,
      apply: ({ attrs }) => {
        const value = text(settings, attrs['data-site-text']);
        return value ? { inner: escapeText(value) } : null;
      },
    },
  ];

  return transformHtml(html, handlers);
}

// Danh mục mặc định: phải trùng DEFAULT_PRODUCT_CATEGORIES trong app.js và
// data/product_categories.json — có test giữ ba nơi khớp nhau.
const DEFAULT_CATEGORIES = [
  { slug: 'color-metal', name: 'Kim Loại Màu' },
  { slug: 'black-metal', name: 'Kim Loại Đen' },
  { slug: 'rare-earth', name: 'Đất Hiếm' },
];

// Cùng quy tắc với pickVisibleCategories() trong app.js: bỏ mục ẩn, hết mục thì
// về mặc định — để tab, khối bên hông và chân trang luôn giống nhau.
function pickVisibleCategories(items) {
  const usable = (items || []).filter((item) => item && item.slug && item.visible !== false);
  return usable.length ? usable : DEFAULT_CATEGORIES;
}

// Phải cho ra cùng một DOM với renderCategoryLinks() trong app.js — lệch nhau
// là danh sách chớp khi app.js dựng lại.
function renderCategoryLinks(categories) {
  return categories
    .map((category) => {
      const href = `/products?filter=${encodeURIComponent(category.slug)}`;
      return `<li><a href="${escapeAttr(href)}">${escapeText(category.name)}</a></li>`;
    })
    .join('');
}

// Thanh tab chỉ được ghi tên; số lượng sản phẩm do app.js điền sau khi tải xong
// danh sách sản phẩm (xem renderCategoryTabs trong app.js).
const TAB_BARS = {
  'home-filter-tabs': { buttonClass: 'home-filter-btn', countHtml: '<em></em>' },
  'product-filter-tabs': { buttonClass: 'product-filter-btn', countHtml: '<span class="filter-count"></span>' },
};

function renderCategoryTabs(categories, { buttonClass, countHtml }) {
  return [{ slug: 'all', name: 'Tất Cả' }, ...categories]
    .map((tab, index) => {
      const active = index === 0;
      return `<button class="${buttonClass}${active ? ' active' : ''}" data-filter="${escapeAttr(tab.slug)}"`
        + ` role="tab" aria-selected="${active}">${escapeText(tab.name)} ${countHtml}</button>`;
    })
    .join('');
}

function applyCategoriesToHtml(html, items) {
  const categories = pickVisibleCategories(items);
  return transformHtml(html, [
    {
      match: (tagName, attrs) => 'data-category-list' in attrs,
      apply: () => ({ inner: renderCategoryLinks(categories) }),
    },
    {
      match: (tagName, attrs) => Object.hasOwn(TAB_BARS, attrs.id || ''),
      apply: ({ attrs }) => ({ inner: renderCategoryTabs(categories, TAB_BARS[attrs.id]) }),
    },
  ]);
}

function normalizeNavPath(value) {
  return String(value || '').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
}

// Trang phục vụ ở /x (nginx thử $uri.html), trang chủ ở /.
function pagePathForFile(file) {
  const name = path.basename(file, '.html');
  return name === 'index' ? '/' : `/${name}`;
}

// Cùng thang điểm với markActiveNavLink() trong app.js. Trang tĩnh không có
// #hash nên currentHash luôn rỗng.
function navScore(href, currentPath) {
  if (/^https?:\/\//i.test(href)) return 0;
  const [rawPath, rawHash] = href.split('#');
  const linkPath = rawPath ? normalizeNavPath(rawPath) : currentPath;
  const linkHash = rawHash ? `#${rawHash}` : '';
  if (linkPath === currentPath && !linkHash) return 3;
  if (linkPath !== '/' && currentPath.startsWith(`${linkPath}/`)) return 1;
  return 0;
}

const SUBMENU_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';

// Phải cho ra cùng một DOM với renderNavItems() + markActiveNavLink() trong
// app.js: cùng mẫu thẻ, cùng cách lọc, cùng chọn mục đang xem (mục điểm cao
// nhất, hoà thì mục đứng trước; mục con khớp thì làm sáng cả mục cha).
function renderNavigation(items, currentPath) {
  if (!Array.isArray(items)) return '';
  const usable = (item) => item && item.visible !== false && String(item.label ?? '').trim() && safeUrl(item.url);
  const entries = items.filter(usable).map((item) => ({
    item,
    children: (Array.isArray(item.children) ? item.children : []).filter(usable),
  }));
  if (!entries.length) return '';

  let best = null;
  let bestScore = 0;
  entries.forEach((entry, entryIndex) => {
    [entry.item, ...entry.children].forEach((link, position) => {
      const score = navScore(safeUrl(link.url), currentPath);
      if (score > bestScore) {
        best = { entryIndex, childIndex: position - 1 };
        bestScore = score;
      }
    });
  });

  return entries
    .map(({ item, children }, entryIndex) => {
      const topActive = best && best.entryIndex === entryIndex;
      const link = `<a href="${escapeAttr(safeUrl(item.url))}" class="nav-link${topActive ? ' active' : ''}">${escapeText(item.label)}</a>`;
      if (!children.length) return `<li>${link}</li>`;

      const submenu = children
        .map((child, childIndex) => {
          const childActive = topActive && best.childIndex === childIndex;
          return `<li><a href="${escapeAttr(safeUrl(child.url))}" class="nav-link nav-sublink${childActive ? ' active' : ''}">${escapeText(child.label)}</a></li>`;
        })
        .join('');

      return `<li class="has-submenu">${link}`
        + `<button type="button" class="nav-submenu-toggle" aria-expanded="false" aria-label="Mở menu con ${escapeAttr(item.label)}">`
        + `${SUBMENU_ICON}</button>`
        + `<ul class="nav-submenu">${submenu}</ul></li>`;
    })
    .join('');
}

function applyNavigationToHtml(html, items, currentPath) {
  const inner = renderNavigation(items, currentPath);
  if (!inner) return html;
  return transformHtml(html, [
    {
      match: (tagName, attrs) => tagName === 'ul' && classList(attrs).includes('nav-links'),
      apply: () => ({ inner }),
    },
  ]);
}

const PAGE_CODE_BY_FILE = {
  'index.html': 'home',
  'products.html': 'products',
  'projects.html': 'projects',
  'news.html': 'news',
  'pricing.html': 'pricing',
  'estimator.html': 'estimator',
  'contact.html': 'contact',
};

// Mã trang nằm trên thẻ body (`<body data-page="home">`); tên file chỉ là phương
// án dự phòng cho HTML chưa kịp đánh dấu.
function pageCodeFromHtml(html, file) {
  const match = String(html).match(/<body[^>]*\sdata-page="([^"]+)"/i);
  if (match) return match[1];
  return PAGE_CODE_BY_FILE[path.basename(file || '')] || null;
}

// Phải cho ra cùng một DOM với renderPageList() trong app.js.
function renderPageList(items) {
  if (!Array.isArray(items)) return '';
  return items
    .map((line) => (typeof line === 'string' ? line.trim() : ''))
    .filter(Boolean)
    .map((line) => `<li>${escapeText(line)}</li>`)
    .join('');
}

// Một ô SEO điền cho nhiều thẻ: title → <title> + og:title + twitter:title...
function applyPageContentToHtml(html, content, file) {
  const page = pageCodeFromHtml(html, file);
  if (!page) return html;
  const texts = content?.texts?.[page];
  const seo = content?.seo?.[page];
  const pageText = (key) => {
    const value = texts && typeof texts[key] === 'string' ? texts[key].trim() : '';
    return value || null;
  };

  return transformHtml(html, [
    {
      match: (tagName, attrs) => 'data-page-text' in attrs || 'data-page-href' in attrs,
      apply: ({ attrs, rawAttrs }) => {
        const label = 'data-page-text' in attrs ? pageText(attrs['data-page-text']) : null;
        const url = 'data-page-href' in attrs ? safeUrl(pageText(attrs['data-page-href'])) : '';
        if (!label && !url) return null;
        return {
          ...(label ? { inner: escapeText(label).replace(/\n/g, '<br>') } : {}),
          ...(url ? { rawAttrs: setAttr(rawAttrs, 'href', url) } : {}),
        };
      },
    },
    {
      match: (tagName, attrs) => 'data-page-list' in attrs,
      apply: ({ attrs }) => {
        const list = renderPageList(texts?.[attrs['data-page-list']]);
        return list ? { inner: list } : null;
      },
    },
    {
      match: (tagName, attrs) => 'data-page-seo' in attrs,
      apply: ({ tagName, attrs, rawAttrs }) => {
        const key = attrs['data-page-seo'];
        const raw = seo && typeof seo[key] === 'string' ? seo[key].trim() : '';
        const value = key === 'image' ? safeUrl(raw) : raw;
        if (!value) return null;
        if (tagName === 'title') return { inner: escapeText(value) };
        return { rawAttrs: setAttr(rawAttrs, 'content', value) };
      },
    },
  ]);
}

async function fetchPageContent() {
  const res = await fetch(`${CMS}/api/page-content`, { signal: AbortSignal.timeout(10000) });
  // Single type chưa có bản ghi thì Strapi trả 404 — đó là "chưa có dữ liệu",
  // không phải lỗi, nên đừng cảnh báo mỗi lượt prerender vì nó.
  if (res.status === 404) return {};
  if (!res.ok) throw new Error(`CMS trả về ${res.status} khi đọc nội dung trang`);
  const json = await res.json();
  const data = json.data;
  return data?.attributes || data || {};
}

async function fetchNavigation() {
  const res = await fetch(`${CMS}/api/navigation`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`CMS trả về ${res.status} khi đọc menu`);
  const json = await res.json();
  const record = json.data?.attributes || json.data;
  const raw = record?.items;
  return Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
}

async function fetchCategories() {
  const res = await fetch(`${CMS}/api/product-categories?sort=sort_order:asc&pagination[limit]=100`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`CMS trả về ${res.status} khi đọc danh mục`);
  const json = await res.json();
  return (json.data || []).map((item) => item.attributes || item);
}

async function fetchSettings() {
  const res = await fetch(`${CMS}/api/site-setting`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`CMS trả về ${res.status}`);
  const json = await res.json();
  const data = json.data;
  const settings = data?.attributes || data;
  if (!settings || !Object.keys(settings).length) throw new Error('CMS chưa có cài đặt website');
  return settings;
}

const SOURCE_LABELS = ['cài đặt website', 'danh mục', 'menu', 'nội dung trang'];

// Bốn nguồn đọc độc lập: nguồn nào lỗi thì bỏ qua riêng phần đó, vì HTML ghi
// được phần nào đỡ chớp phần đó. Chỉ bỏ cuộc khi cả bốn cùng lỗi — và khi đó báo
// đủ bốn lý do, không nuốt mất lý do nào.
async function prerenderDirectory(
  target,
  {
    sourceDir = target,
    loadSettings = fetchSettings,
    loadCategories = fetchCategories,
    loadNavigation = fetchNavigation,
    loadPageContent = fetchPageContent,
    log = console,
  } = {},
) {
  // Luôn dựng từ bản mẫu trong repo rồi ghi sang thư mục phục vụ: ô nào quản trị
  // xoá trắng sẽ quay về chữ mặc định ngay lần lưu kế tiếp, thay vì giữ nội dung
  // của lần ghi trước tới tận lần deploy sau.
  if (!fs.existsSync(sourceDir)) throw new Error(`không tìm thấy thư mục nguồn ${sourceDir}`);

  const results = await Promise.allSettled([loadSettings(), loadCategories(), loadNavigation(), loadPageContent()]);
  const [settings, categories, navigation, pageContent] = results.map((result) => (result.status === 'fulfilled' ? result.value : null));
  const failures = results.map((result, index) =>
    result.status === 'rejected' ? `${SOURCE_LABELS[index]}: ${result.reason?.message || result.reason}` : null,
  );

  if (failures.every(Boolean)) throw new Error(`Không đọc được gì từ CMS — ${failures.join('; ')}`);
  failures.filter(Boolean).forEach((failure) => log.warn(`⚠️  Bỏ qua ${failure}`));

  const files = fs.readdirSync(sourceDir).filter((file) => file.endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const html = fs.readFileSync(path.join(sourceDir, file), 'utf8');
    let out = html;
    if (settings) out = applySettingsToHtml(out, settings);
    if (categories) out = applyCategoriesToHtml(out, categories);
    if (navigation) out = applyNavigationToHtml(out, navigation, pagePathForFile(file));
    if (pageContent) out = applyPageContentToHtml(out, pageContent, file);

    const destFile = path.join(target, file);
    const current = fs.existsSync(destFile) ? fs.readFileSync(destFile, 'utf8') : null;
    if (out !== current) {
      fs.writeFileSync(destFile, out, 'utf8');
      changed += 1;
    }
  }
  return {
    changed,
    total: files.length,
    settings: Boolean(settings),
    categories: Boolean(categories),
    navigation: Boolean(navigation),
    pageContent: Boolean(pageContent),
  };
}

async function main() {
  const target = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const sourceDir = path.resolve(process.argv[3] || target);
  const result = await prerenderDirectory(target, { sourceDir });
  const parts = [
    result.settings && 'cài đặt website',
    result.categories && 'danh mục',
    result.navigation && 'menu',
    result.pageContent && 'nội dung trang',
  ]
    .filter(Boolean)
    .join(' + ');
  const from = sourceDir !== target ? ` từ ${sourceDir}` : '';
  console.log(`✓ ${parts} đã ghi${from} vào ${result.changed}/${result.total} trang trong ${target}`);
}

module.exports = {
  applySettingsToHtml,
  applyCategoriesToHtml,
  applyNavigationToHtml,
  applyPageContentToHtml,
  pageCodeFromHtml,
  renderPageList,
  renderCategoryLinks,
  renderFooterLinks,
  renderNavigation,
  pickVisibleCategories,
  pagePathForFile,
  prerenderDirectory,
  fetchPageContent,
  safeUrl,
  DEFAULT_CATEGORIES,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`✗ Không ghi được cài đặt vào HTML: ${err.message}`);
    process.exit(1);
  });
}
