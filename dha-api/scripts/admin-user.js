#!/usr/bin/env node
'use strict';

// Quản lý tài khoản khu quản trị (thay trang Users của Strapi).
//
//   node --env-file=.env scripts/admin-user.js create <email> [--first=Tên] [--last=Họ]
//   node --env-file=.env scripts/admin-user.js set-password <email>
//   node --env-file=.env scripts/admin-user.js disable <email>
//   node --env-file=.env scripts/admin-user.js enable <email>
//
// Mật khẩu chỉ nhận qua bàn phím (ẩn ký tự) hoặc stdin — không bao giờ qua đối
// số dòng lệnh, vì đối số nằm lại trong lịch sử shell và danh sách tiến trình.
const readline = require('node:readline');

const { SANITY_API_VERSION } = require('../src/config');
const { createSanityClient } = require('../src/sanity/client');
const { createSanityStore } = require('../src/sanity/store');
const users = require('./lib/admin-user');

const USAGE = 'Dùng: admin-user.js <create|set-password|disable|enable> <email> [--first=..] [--last=..]';

function sanityFromEnv(env = process.env) {
  const missing = ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_API_TOKEN'].filter((name) => !env[name]);
  if (missing.length) throw new Error(`Thiếu biến môi trường: ${missing.join(', ')}`);
  return { projectId: env.SANITY_PROJECT_ID, dataset: env.SANITY_DATASET, token: env.SANITY_API_TOKEN, apiVersion: SANITY_API_VERSION };
}

function parseFlags(args) {
  return Object.fromEntries(
    args.filter((arg) => arg.startsWith('--')).map((arg) => {
      const [key, ...rest] = arg.slice(2).split('=');
      return [key, rest.join('=')];
    }),
  );
}

async function readHidden(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  rl._writeToOutput = (text) => {
    if (!muted) rl.output.write(text);
  };
  const answer = await new Promise((resolve) => {
    rl.question(prompt, resolve);
    muted = true;
  });
  rl.close();
  process.stdout.write('\n');
  return answer;
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    return data.replace(/\r?\n$/, '');
  }
  const first = await readHidden('Mật khẩu: ');
  const second = await readHidden('Nhập lại: ');
  if (first !== second) throw new Error('Hai lần nhập không khớp.');
  return first;
}

async function run(argv) {
  const [command, email, ...rest] = argv;
  if (!command || !email) throw new Error(USAGE);
  const store = createSanityStore({ client: createSanityClient(sanityFromEnv()) });
  const flags = parseFlags(rest);

  switch (command) {
    case 'create': {
      const user = await users.createAdminUser(store, { email, password: await readPassword(), firstname: flags.first || '', lastname: flags.last || '' });
      return `Đã tạo ${user.email} (${user.documentId}).`;
    }
    case 'set-password':
      await users.setPassword(store, { email, password: await readPassword() });
      return `Đã đổi mật khẩu cho ${users.normalizeEmail(email)}.`;
    case 'disable':
      await users.setActive(store, { email, isActive: false });
      return `Đã khoá ${users.normalizeEmail(email)}.`;
    case 'enable':
      await users.setActive(store, { email, isActive: true });
      return `Đã mở khoá ${users.normalizeEmail(email)}.`;
    default:
      throw new Error(USAGE);
  }
}

run(process.argv.slice(2)).then(
  (message) => console.log(message),
  (err) => {
    console.error(err.message);
    process.exit(1);
  },
);
