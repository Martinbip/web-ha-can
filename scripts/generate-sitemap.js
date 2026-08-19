#!/usr/bin/env node
// Sinh sitemap.xml gồm các trang tĩnh và từng bài tin tức đang xuất bản.
//
//   node scripts/generate-sitemap.js [đường/dẫn/sitemap.xml]
//
// Chạy trên VPS trong lúc deploy: đọc Strapi qua localhost nên không phụ thuộc
// DNS hay chứng chỉ. Bài viết chỉ có trong sitemap khi đã xuất bản — API công
// khai vốn chỉ trả bản đã xuất bản.
const fs = require('node:fs');
const path = require('node:path');

const SITE = process.env.SITE_URL || 'https://dhakimloaimau.vn';
const CMS = process.env.CMS_URL || 'http://127.0.0.1:1337';
const OUTPUT = process.argv[2] || path.join(__dirname, '..', 'sitemap.xml');

const STATIC_PAGES = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/products', changefreq: 'weekly', priority: '0.9' },
  { loc: '/pricing', changefreq: 'weekly', priority: '0.8' },
  { loc: '/estimator', changefreq: 'monthly', priority: '0.7' },
  { loc: '/projects', changefreq: 'monthly', priority: '0.7' },
  { loc: '/news', changefreq: 'weekly', priority: '0.8' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.6' },
];

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[char]};`);
}

function toUrlEntry({ loc, changefreq, priority, lastmod }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(SITE + loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n');
}

async function fetchArticles() {
  const res = await fetch(`${CMS}/api/news-articles?pagination[pageSize]=500&sort=date:desc`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`CMS trả về ${res.status}`);
  const json = await res.json();
  return (json.data || []).map((item) => item.attributes || item).filter((item) => item.slug);
}

(async () => {
  const articles = await fetchArticles();

  const entries = [
    ...STATIC_PAGES.map(toUrlEntry),
    ...articles.map((article) =>
      toUrlEntry({
        loc: `/tin-tuc/${encodeURIComponent(article.slug)}`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: article.updatedAt || article.date,
      }),
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  fs.writeFileSync(OUTPUT, xml, 'utf8');
  console.log(`✓ sitemap: ${STATIC_PAGES.length} trang tĩnh + ${articles.length} bài viết → ${OUTPUT}`);
})().catch((err) => {
  console.error(`✗ Không sinh được sitemap: ${err.message}`);
  process.exit(1);
});
