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

export function analyzeSeo(values) {
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
