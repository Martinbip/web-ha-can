#!/usr/bin/env node
// Ghi cài đặt website và danh mục sản phẩm của CMS thẳng vào các file HTML tĩnh.
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
    if (VOID_TAGS.has(tagName.toLowerCase()) || rawAttrs.endsWith('/')) continue;

    const attrs = parseAttrs(rawAttrs);
    const handler = handlers.find((each) => each.match(tagName.toLowerCase(), attrs));
    if (!handler) continue;

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

function applySettingsToHtml(html, settings) {
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

// Cài đặt và danh mục đọc độc lập: một bên lỗi thì vẫn ghi bên kia, vì HTML
// ghi được phần nào đỡ chớp phần đó. Chỉ bỏ cuộc khi cả hai cùng lỗi.
async function prerenderDirectory(
  target,
  { loadSettings = fetchSettings, loadCategories = fetchCategories, log = console } = {},
) {
  const [settingsResult, categoriesResult] = await Promise.allSettled([loadSettings(), loadCategories()]);
  const settings = settingsResult.status === 'fulfilled' ? settingsResult.value : null;
  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : null;

  if (!settings && !categories) throw settingsResult.reason;
  if (!settings) log.warn(`⚠️  Bỏ qua cài đặt website: ${settingsResult.reason.message}`);
  if (!categories) log.warn(`⚠️  Bỏ qua danh mục: ${categoriesResult.reason.message}`);

  const files = fs.readdirSync(target).filter((file) => file.endsWith('.html'));
  let changed = 0;
  for (const file of files) {
    const full = path.join(target, file);
    const html = fs.readFileSync(full, 'utf8');
    let out = html;
    if (settings) out = applySettingsToHtml(out, settings);
    if (categories) out = applyCategoriesToHtml(out, categories);
    if (out !== html) {
      fs.writeFileSync(full, out, 'utf8');
      changed += 1;
    }
  }
  return { changed, total: files.length, settings: Boolean(settings), categories: Boolean(categories) };
}

async function main() {
  const target = path.resolve(process.argv[2] || path.join(__dirname, '..'));
  const result = await prerenderDirectory(target);
  const parts = [result.settings && 'cài đặt website', result.categories && 'danh mục']
    .filter(Boolean)
    .join(' + ');
  console.log(`✓ ${parts} đã ghi vào ${result.changed}/${result.total} trang trong ${target}`);
}

module.exports = {
  applySettingsToHtml,
  applyCategoriesToHtml,
  renderCategoryLinks,
  pickVisibleCategories,
  prerenderDirectory,
  DEFAULT_CATEGORIES,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`✗ Không ghi được cài đặt vào HTML: ${err.message}`);
    process.exit(1);
  });
}
