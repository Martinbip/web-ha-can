// Dữ liệu cấu trúc (JSON-LD) cho trang chủ: công ty là ai, ở đâu, liên hệ thế
// nào. Google dùng nó cho khung thông tin doanh nghiệp và để nối website với
// các trang mạng xã hội. Mọi giá trị lấy từ Cài đặt website — sửa hotline,
// địa chỉ trong admin là dữ liệu này đổi theo ở lần prerender kế tiếp.
const SITE = process.env.SITE_URL || 'https://dhakimloaimau.vn';
const BRAND = 'Kim Loại Màu DHA';
const LEGAL_NAME = 'Công ty Cổ phần Kim Loại Màu DHA';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// 0867259078 → +84867259078: Google cần số kèm mã quốc gia.
function toInternationalPhone(value) {
  const digits = text(value).replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('84')) return `+${digits}`;
  if (digits.startsWith('0')) return `+84${digits.slice(1)}`;
  return digits;
}

function absoluteUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${SITE}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function buildOrganization(settings = {}) {
  const phone = toInternationalPhone(settings.hotline);
  const email = text(settings.email);
  const address = text(settings.address);
  const sameAs = ['facebook_url', 'youtube_url', 'zalo_url', 'twitter_url']
    .map((key) => text(settings[key]))
    .filter((url) => /^https?:\/\//i.test(url));

  const organization = {
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name: BRAND,
    legalName: LEGAL_NAME,
    url: `${SITE}/`,
    logo: absoluteUrl(settings.logo_image_url) || undefined,
    telephone: phone || undefined,
    email: email || undefined,
    taxID: text(settings.tax_code) || undefined,
    address: address
      ? { '@type': 'PostalAddress', streetAddress: address, addressCountry: 'VN' }
      : undefined,
    contactPoint: phone
      ? [{ '@type': 'ContactPoint', telephone: phone, contactType: 'sales', areaServed: 'VN', availableLanguage: ['vi'] }]
      : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${SITE}/#website`,
    url: `${SITE}/`,
    name: BRAND,
    inLanguage: 'vi',
    publisher: { '@id': `${SITE}/#organization` },
  };

  return { '@context': 'https://schema.org', '@graph': [organization, website] };
}

function renderOrganizationScript(settings) {
  const json = JSON.stringify(buildOrganization(settings)).replace(/</g, '\\u003c');
  return `<script type="application/ld+json" id="organization-jsonld">${json}</script>`;
}

// Ghi (hoặc thay) khối JSON-LD ngay trước </head> của trang chủ.
function applyOrganizationToHtml(html, settings) {
  const script = renderOrganizationScript(settings);
  const existing = /<script type="application\/ld\+json" id="organization-jsonld">[\s\S]*?<\/script>/;
  if (existing.test(html)) return html.replace(existing, script);
  return html.replace(/<\/head>/i, `    ${script}\n</head>`);
}

module.exports = { buildOrganization, applyOrganizationToHtml, toInternationalPhone };
