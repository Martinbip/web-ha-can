// Kiểm tra SEO cho bài viết ngay trong form soạn — không gửi đi đâu, chỉ đọc giá
// trị đang nhập. Ngưỡng theo thực tế hiển thị của Google: tiêu đề bị cắt quanh
// 60 ký tự, mô tả quanh 160 ký tự.
const SITE_HOST = 'dhakimloaimau.vn';
export const SITE_NAME_SUFFIX = ' - DHA Minerals';
export const TITLE_LIMIT = 60;
export const DESCRIPTION_LIMIT = 160;
const MIN_WORDS = 300;

// Link trỏ về chính website. Khớp isInternalArticleLink() trong app.js.
export function isInternalHref(href) {
  const raw = String(href || '').trim();
  if (raw.startsWith('/') || raw.startsWith('#')) return !/^\/[/\\]/.test(raw);
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) && url.hostname.replace(/^www\./, '') === SITE_HOST;
  } catch {
    return false;
  }
}

export function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  return words.length;
}

// So khớp không phân biệt hoa thường, dấu cách thừa.
function contains(haystack, needle) {
  const normalize = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const target = normalize(needle);
  return Boolean(target) && normalize(haystack).includes(target);
}

function firstParagraphText(html) {
  const match = String(html || '').match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (match) return htmlToText(match[1]);
  return htmlToText(html).split(/(?<=[.!?])\s/)[0] || '';
}

// Giá trị website thực sự dùng — ô SEO bỏ trống thì lấy tiêu đề, tóm tắt.
export function effectiveSeo(values) {
  const title = String(values.title || '').trim();
  return {
    title: String(values.seo_title || '').trim() || (title ? `${title}${SITE_NAME_SUFFIX}` : ''),
    description: String(values.seo_description || '').trim() || String(values.summary || '').trim(),
  };
}

// Khớp truncateMetaText() trong app.js: website cắt mô tả sản phẩm như vậy khi
// ô Mô tả SEO bỏ trống.
export function truncateMetaText(text, limit = DESCRIPTION_LIMIT) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

function toSlug(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function finish(checks) {
  const result = checks.map((check) => ({
    id: check.id,
    status: check.ok ? 'good' : check.warn ? 'warn' : 'bad',
    text: check.ok ? check.text : check.failText || check.text,
  }));
  const score = Math.round((result.filter((check) => check.status === 'good').length / result.length) * 100);
  return { checks: result, score };
}

// Trang sản phẩm ngắn hơn bài viết: không đòi 300 chữ hay tiêu đề mục, mà xét
// tên, mô tả, ảnh, thông số — đúng những gì khách cần để quyết định hỏi giá.
function analyzeProductSeo(values) {
  const name = String(values.name || '').trim();
  const title = String(values.seo_title || '').trim() || (name ? `${name}${SITE_NAME_SUFFIX}` : '');
  const body = String(values.description || '').trim();
  const description = String(values.seo_description || '').trim() || truncateMetaText(body);
  const keyword = String(values.focus_keyword || '').trim();
  const specs = values.specs && typeof values.specs === 'object' ? Object.values(values.specs).filter((item) => String(item || '').trim()) : [];
  const slugKeyword = toSlug(keyword);
  const checks = [
    {
      id: 'title-length',
      ok: title.length >= 30 && title.length <= TITLE_LIMIT,
      warn: title.length > 0,
      text: `Tiêu đề SEO dài ${title.length} ký tự (nên 30–${TITLE_LIMIT}).`,
    },
    {
      id: 'description-length',
      ok: description.length >= 120 && description.length <= DESCRIPTION_LIMIT,
      warn: description.length > 0,
      text: `Mô tả SEO dài ${description.length} ký tự (nên 120–${DESCRIPTION_LIMIT}).`,
    },
    {
      id: 'body-length',
      ok: body.length >= 150,
      warn: body.length > 0,
      text: `Phần Mô tả dài ${body.length} ký tự (nên từ 150 ký tự trở lên).`,
    },
    {
      id: 'image',
      ok: Boolean(String(values.image || '').trim()),
      text: 'Sản phẩm có ảnh.',
      failText: 'Sản phẩm chưa có ảnh — ảnh hiện trên Google và khi chia sẻ.',
    },
    {
      id: 'specs',
      ok: specs.length >= 3,
      warn: specs.length > 0,
      text: `Có ${specs.length} dòng thông số kỹ thuật (nên từ 3 dòng).`,
    },
  ];
  if (keyword) {
    checks.unshift(
      { id: 'keyword-title', ok: contains(title, keyword), text: 'Từ khoá chính có trong tiêu đề SEO.', failText: 'Từ khoá chính chưa có trong tiêu đề SEO.' },
      { id: 'keyword-description', ok: contains(description, keyword), text: 'Từ khoá chính có trong mô tả SEO.', failText: 'Từ khoá chính chưa có trong mô tả SEO.' },
      { id: 'keyword-body', ok: contains(body, keyword), text: 'Từ khoá chính có trong phần Mô tả sản phẩm.', failText: 'Từ khoá chính chưa có trong phần Mô tả sản phẩm.' },
      {
        id: 'keyword-slug',
        ok: Boolean(slugKeyword) && toSlug(values.uid).includes(slugKeyword),
        warn: true,
        text: 'Mã/đường dẫn chứa từ khoá chính.',
        failText: `Mã/đường dẫn chưa chứa từ khoá (dạng không dấu: ${slugKeyword || '—'}). Chỉ nên đổi mã khi sản phẩm còn mới.`,
      },
    );
  } else {
    checks.unshift({ id: 'keyword', ok: false, warn: true, text: 'Chưa nhập từ khoá chính — nhập để được kiểm tra kỹ hơn.' });
  }
  return { title, description, words: countWords(body), ...finish(checks) };
}

export function analyzeSeo(values, { kind = 'article' } = {}) {
  if (kind === 'product') return analyzeProductSeo(values);
  const { title, description } = effectiveSeo(values);
  const keyword = String(values.focus_keyword || '').trim();
  const content = String(values.content || '');
  const text = htmlToText(content);
  const words = countWords(text);
  const images = content.match(/<img\b[^>]*>/gi) || [];
  const imagesWithoutAlt = images.filter((tag) => !/\balt="[^"]+"/i.test(tag));
  const links = [...content.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)].map((match) => match[1]);
  const slugKeyword = keyword
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const checks = [
    {
      id: 'title-length',
      ok: title.length >= 30 && title.length <= TITLE_LIMIT,
      warn: title.length > 0,
      text: `Tiêu đề SEO dài ${title.length} ký tự (nên 30–${TITLE_LIMIT}).`,
    },
    {
      id: 'description-length',
      ok: description.length >= 120 && description.length <= DESCRIPTION_LIMIT,
      warn: description.length > 0,
      text: `Mô tả SEO dài ${description.length} ký tự (nên 120–${DESCRIPTION_LIMIT}).`,
    },
    {
      id: 'content-length',
      ok: words >= MIN_WORDS,
      warn: words >= 150,
      text: `Bài dài ${words} chữ (nên từ ${MIN_WORDS} chữ trở lên).`,
    },
    {
      id: 'headings',
      ok: /<h2\b/i.test(content),
      text: 'Bài có tiêu đề mục (H2) chia đoạn.',
      failText: 'Chưa có tiêu đề mục (H2) — chia bài thành các phần giúp Google hiểu nội dung.',
    },
    {
      id: 'image-alt',
      ok: images.length > 0 && imagesWithoutAlt.length === 0,
      warn: images.length === 0,
      text: images.length ? 'Mọi ảnh trong bài đều có mô tả (alt).' : 'Bài chưa có ảnh minh hoạ nào.',
      failText: images.length ? `${imagesWithoutAlt.length}/${images.length} ảnh chưa có mô tả (alt) — bấm vào ảnh để thêm.` : undefined,
    },
    {
      id: 'internal-link',
      ok: links.some(isInternalHref),
      text: 'Bài có link nội bộ tới trang khác trong website.',
      failText: 'Chưa có link nội bộ — gắn link tới sản phẩm hoặc bài liên quan (nút Liên kết → tìm trong website).',
    },
  ];

  if (keyword) {
    checks.unshift(
      {
        id: 'keyword-title',
        ok: contains(title, keyword),
        text: 'Từ khoá chính có trong tiêu đề SEO.',
        failText: 'Từ khoá chính chưa có trong tiêu đề SEO.',
      },
      {
        id: 'keyword-description',
        ok: contains(description, keyword),
        text: 'Từ khoá chính có trong mô tả SEO.',
        failText: 'Từ khoá chính chưa có trong mô tả SEO.',
      },
      {
        id: 'keyword-slug',
        ok: Boolean(slugKeyword) && String(values.slug || '').includes(slugKeyword),
        text: 'Đường dẫn chứa từ khoá chính.',
        failText: `Đường dẫn chưa chứa từ khoá (dạng không dấu: ${slugKeyword || '—'}).`,
      },
      {
        id: 'keyword-intro',
        ok: contains(firstParagraphText(content), keyword),
        text: 'Từ khoá chính xuất hiện ở đoạn mở đầu.',
        failText: 'Từ khoá chính chưa xuất hiện ở đoạn mở đầu.',
      },
    );
  } else {
    checks.unshift({
      id: 'keyword',
      ok: false,
      warn: true,
      text: 'Chưa nhập từ khoá chính — nhập để được kiểm tra kỹ hơn.',
      failText: 'Chưa nhập từ khoá chính — nhập để được kiểm tra kỹ hơn.',
    });
  }

  const result = checks.map((check) => ({
    id: check.id,
    status: check.ok ? 'good' : check.warn ? 'warn' : 'bad',
    text: check.ok ? check.text : check.failText || check.text,
  }));
  const score = Math.round((result.filter((check) => check.status === 'good').length / result.length) * 100);
  return { title, description, checks: result, score, words };
}
