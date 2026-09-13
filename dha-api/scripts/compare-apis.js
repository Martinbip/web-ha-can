#!/usr/bin/env node
'use strict';

// Đối chiếu Strapi với dha-api trước khi chuyển (spec mục 8, runbook bước 8).
//
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/compare-apis.js http://127.0.0.1:1337 http://127.0.0.1:1338
//
// Không có ADMIN_EMAIL/ADMIN_PASSWORD thì chỉ so API công khai. Thoát mã 1 nếu
// có khác biệt. Log có thể chứa dữ liệu khách (danh sách liên hệ) — chỉ chạy
// trên VPS, không chép log ra ngoài.
const { compareResponses } = require('./lib/compare');
const { PUBLIC_ENDPOINTS, DETAIL_COLLECTIONS, ADMIN_TYPES } = require('./lib/endpoints');

const [baseA, baseB] = process.argv.slice(2).map((url) => url && url.replace(/\/$/, ''));
if (!baseA || !baseB) {
  console.error('Dùng: compare-apis.js <gốc-A> <gốc-B>');
  process.exit(2);
}

function short(value) {
  const text = JSON.stringify(value);
  return text && text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

async function get(base, path, cookie) {
  const res = await fetch(`${base}/api/${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // giữ nguyên văn bản để so
  }
  return { status: res.status, body };
}

async function login(base) {
  const res = await fetch(`${base}/api/admin-ui/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Đăng nhập ${base} thất bại: HTTP ${res.status}`);
  return res.headers.getSetCookie()[0].split(';')[0];
}

async function detailPaths() {
  const paths = [];
  for (const collection of DETAIL_COLLECTIONS) {
    const listPath = collection === 'news' ? 'news-articles' : collection;
    const { body } = await get(baseA, `${listPath}?pagination[limit]=100`);
    for (const row of (body && body.data) || []) paths.push({ path: `${collection}/${row.documentId}` });
  }
  return paths;
}

async function adminPaths(cookie) {
  const paths = [{ path: 'admin-ui/meta' }, { path: 'admin-ui/navigation' }, { path: 'admin-ui/dashboard' }, { path: 'admin-ui/media' }];
  for (const type of ADMIN_TYPES) {
    paths.push({ path: `admin-ui/resources/${type}?page=1&pageSize=100` });
    const { body } = await get(baseA, `admin-ui/resources/${type}?page=1&pageSize=100`, cookie);
    const rows = Array.isArray(body && body.data) ? body.data : [];
    for (const row of rows) paths.push({ path: `admin-ui/resources/${type}/${row.documentId}` });
  }
  return paths;
}

async function main() {
  const seen = new Set();
  const publicPaths = [...PUBLIC_ENDPOINTS, ...(await detailPaths())].filter((item) => !seen.has(item.path) && seen.add(item.path));

  const withAdmin = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
  const cookies = withAdmin ? [await login(baseA), await login(baseB)] : [null, null];
  const privatePaths = withAdmin ? await adminPaths(cookies[0]) : [];

  let failures = 0;
  let warnings = 0;
  for (const { path, unordered } of [...publicPaths, ...privatePaths]) {
    const cookieA = path.startsWith('admin-ui/') ? cookies[0] : null;
    const cookieB = path.startsWith('admin-ui/') ? cookies[1] : null;
    const [a, b] = await Promise.all([get(baseA, path, cookieA), get(baseB, path, cookieB)]);

    if (a.status !== b.status) {
      failures += 1;
      console.log(`✗ ${path}: HTTP ${a.status} ≠ ${b.status}`);
      continue;
    }
    const { differences, orderOnly } = compareResponses(a.body, b.body, { unordered });
    if (orderOnly) {
      warnings += 1;
      console.log(`! ${path}: cùng dữ liệu, khác thứ tự`);
    } else if (differences.length) {
      failures += 1;
      console.log(`✗ ${path}`);
      for (const d of differences) console.log(`    ${d.path}: ${short(d.left)} ≠ ${short(d.right)}`);
    }
  }

  const total = publicPaths.length + privatePaths.length;
  console.log(`\n${total} endpoint${withAdmin ? '' : ' (chưa gồm admin-ui: thiếu ADMIN_EMAIL/ADMIN_PASSWORD)'} — ${failures} khác biệt, ${warnings} cảnh báo thứ tự.`);
  console.log(failures ? 'KHÔNG KHỚP' : 'Khớp');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(2);
});
