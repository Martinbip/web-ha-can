'use strict';

const bcrypt = require('bcryptjs');

// Cùng cost với hash Strapi đang dùng ($2a$10$…) để mọi tài khoản như nhau.
const BCRYPT_COST = 10;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!EMAIL.test(value)) throw new Error(`Email không hợp lệ: ${email}`);
  return value;
}

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }
}

async function findByEmail(store, email) {
  const [user] = await store.documents('adminUser').findMany({ filters: { email: { $eq: email } }, limit: 1 });
  return user || null;
}

async function requireUser(store, email) {
  const normalized = normalizeEmail(email);
  const user = await findByEmail(store, normalized);
  if (!user) throw new Error(`Không có tài khoản ${normalized}.`);
  return user;
}

async function createAdminUser(store, { email, password, firstname = '', lastname = '' }, { cost = BCRYPT_COST } = {}) {
  const normalized = normalizeEmail(email);
  assertPassword(password);
  if (await findByEmail(store, normalized)) throw new Error(`Đã có tài khoản ${normalized}.`);
  const passwordHash = await bcrypt.hash(password, cost);
  return store.documents('adminUser').create({
    data: { email: normalized, passwordHash, firstname, lastname, isActive: true },
  });
}

async function setPassword(store, { email, password }, { cost = BCRYPT_COST } = {}) {
  assertPassword(password);
  const user = await requireUser(store, email);
  const passwordHash = await bcrypt.hash(password, cost);
  return store.documents('adminUser').update({ documentId: user.documentId, data: { passwordHash } });
}

async function setActive(store, { email, isActive }) {
  const user = await requireUser(store, email);
  return store.documents('adminUser').update({ documentId: user.documentId, data: { isActive: Boolean(isActive) } });
}

module.exports = { createAdminUser, setPassword, setActive, normalizeEmail, MIN_PASSWORD_LENGTH };
