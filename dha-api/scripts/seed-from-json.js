#!/usr/bin/env node
'use strict';

// Dựng dataset dev/staging từ data/*.json + dữ liệu mặc định trong code, thay
// phần seed chạy lúc khởi động của dha-cms/src/index.js.
//
//   node dha-api/scripts/seed-from-json.js > dha-api/out/seed.ndjson
//   SANITY_AUTH_TOKEN=... npx sanity@latest datasets import dha-api/out/seed.ndjson development \
//     --project-id "$SANITY_PROJECT_ID" --replace
const path = require('node:path');

const { buildSeedDocuments } = require('./lib/seed-docs');
const { toNdjson } = require('./lib/ndjson');

const dataDir = process.argv[2] || path.join(__dirname, '..', '..', 'data');
process.stdout.write(toNdjson(buildSeedDocuments({ dataDir })));
