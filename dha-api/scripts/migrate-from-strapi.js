#!/usr/bin/env node
'use strict';

// Chạy TRÊN VPS, lúc Strapi còn chạy (spec mục 7, runbook bước 5).
//
//   cd /var/www/dha-api
//   STRAPI_TOKEN=... node --env-file=.env scripts/migrate-from-strapi.js out/migrate.ndjson
//
// Biến môi trường: STRAPI_TOKEN (API token Full access của Strapi, bắt buộc),
// STRAPI_URL (mặc định http://127.0.0.1:1337), STRAPI_DIR (mặc định
// /var/www/dha-cms), STRAPI_DB (mặc định <STRAPI_DIR>/.tmp/data.db),
// CLOUDINARY_URL (chỉ cần khi có ảnh /uploads cũ).
//
// File ra chứa hash mật khẩu và dữ liệu khách hàng: quyền 600, không commit,
// xoá sau khi nạp xong.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const { getTypeOptions } = require('../src/sanity/types');
const { toNdjson } = require('./lib/ndjson');
const { EXPORT_TYPES, toSanityDocuments, adminUsersToDocs, planProjectImage, summarize } = require('./lib/strapi-export');

const STRAPI_URL = (process.env.STRAPI_URL || 'http://127.0.0.1:1337').replace(/\/$/, '');
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
const STRAPI_DIR = process.env.STRAPI_DIR || '/var/www/dha-cms';
const STRAPI_DB = process.env.STRAPI_DB || path.join(STRAPI_DIR, '.tmp', 'data.db');
const PAGE_SIZE = 100;

async function getJson(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${STRAPI_TOKEN}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function fetchCollection(apiPath, status) {
  const rows = [];
  let page = 1;
  let pageCount = 1;
  do {
    const query = `pagination[page]=${page}&pagination[pageSize]=${PAGE_SIZE}&populate=*${status ? `&status=${status}` : ''}`;
    const json = await getJson(`${STRAPI_URL}/api/${apiPath}?${query}`);
    rows.push(...((json && json.data) || []));
    pageCount = (json && json.meta && json.meta.pagination && json.meta.pagination.pageCount) || 1;
    page += 1;
  } while (page <= pageCount);
  return rows;
}

async function fetchSingle(apiPath) {
  const json = await getJson(`${STRAPI_URL}/api/${apiPath}?populate=*`);
  return json && json.data ? [json.data] : [];
}

async function exportContent() {
  const docs = [];
  for (const { path: apiPath, type } of EXPORT_TYPES) {
    const options = getTypeOptions(type);
    let draftRows = [];
    let publishedRows;
    if (options.singletonId) {
      publishedRows = await fetchSingle(apiPath);
    } else if (options.drafts) {
      [draftRows, publishedRows] = await Promise.all([fetchCollection(apiPath, 'draft'), fetchCollection(apiPath, 'published')]);
    } else {
      publishedRows = await fetchCollection(apiPath);
    }
    if (type === 'project') await rehomeProjectImages([...draftRows, ...publishedRows]);
    docs.push(...toSanityDocuments({ type, draftRows, publishedRows }));
  }
  return docs;
}

async function rehomeProjectImages(rows) {
  const pending = rows.map((row) => ({ row, plan: planProjectImage(row) })).filter((item) => item.plan);
  if (!pending.length) return;

  const uploads = pending.filter((item) => item.plan.upload);
  let cloudinary = null;
  if (uploads.length) {
    if (!process.env.CLOUDINARY_URL) {
      throw new Error(`Có ${uploads.length} ảnh dự án nằm ở /uploads của Strapi nhưng thiếu CLOUDINARY_URL: ${uploads.map((item) => item.plan.upload).join(', ')}`);
    }
    cloudinary = require('cloudinary').v2;
    cloudinary.config({ secure: true });
  }

  for (const { row, plan } of pending) {
    let patch = plan.patch;
    if (plan.upload) {
      const result = await cloudinary.uploader.upload(`${STRAPI_URL}${plan.upload}`, {
        resource_type: 'image',
        folder: 'dha/legacy',
        overwrite: false,
        tags: ['dha-legacy'],
      });
      patch = { cloudinary_image_url: result.secure_url, cloudinary_public_id: result.public_id };
      console.error(`  ảnh cũ ${plan.upload} → ${result.public_id}`);
    }
    Object.assign(row, patch);
  }
}

function readAdminUsers() {
  const requireFromStrapi = createRequire(path.join(STRAPI_DIR, 'package.json'));
  const Database = requireFromStrapi('better-sqlite3');
  const db = new Database(STRAPI_DB, { readonly: true, fileMustExist: true });
  try {
    return db.prepare('SELECT document_id, email, firstname, lastname, password, is_active, blocked, created_at FROM admin_users').all();
  } finally {
    db.close();
  }
}

async function main() {
  const outFile = process.argv[2];
  if (!outFile) throw new Error('Dùng: migrate-from-strapi.js <file-ra.ndjson>');
  if (!STRAPI_TOKEN) throw new Error('Thiếu STRAPI_TOKEN (API token Full access của Strapi).');

  const content = await exportContent();
  const { docs: admins, skipped } = adminUsersToDocs(readAdminUsers());
  const docs = [...content, ...admins];

  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, toNdjson(docs), { mode: 0o600 });

  // Chỉ in số lượng — không in dữ liệu khách hàng ra log.
  console.log(JSON.stringify({ file: outFile, total: docs.length, byType: summarize(docs), adminUsersSkipped: skipped }, null, 2));
}

main().catch((err) => {
  console.error(`Chuyển dữ liệu thất bại: ${err.message}`);
  process.exit(1);
});
