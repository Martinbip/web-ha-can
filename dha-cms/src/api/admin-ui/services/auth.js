'use strict';

const crypto = require('node:crypto');
const { sendError } = require('./errors');

const COOKIE_NAME = 'ha_can_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

function getSessionSecret() {
  const secret = process.env.ADMIN_UI_SESSION_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_UI_SESSION_SECRET or ADMIN_JWT_SECRET is required');
  }
  return secret;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

function setSessionCookie(ctx, payload) {
  ctx.cookies.set(COOKIE_NAME, sign(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    overwrite: true,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

function clearSessionCookie(ctx) {
  ctx.cookies.set(COOKIE_NAME, null, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    overwrite: true,
    maxAge: 0,
    path: '/',
  });
}

async function findAdminUser(strapi, email) {
  return strapi.db.query('admin::user').findOne({
    where: { email: String(email || '').trim().toLowerCase(), isActive: true },
    populate: ['roles'],
  });
}

async function validateAdminPassword(strapi, user, password) {
  const adminUserService = strapi.admin && strapi.admin.services && strapi.admin.services.user;
  if (adminUserService && typeof adminUserService.validatePassword === 'function') {
    return adminUserService.validatePassword(password, user.password);
  }

  const bcrypt = require('bcryptjs');
  return bcrypt.compare(password, user.password);
}

async function login(ctx) {
  const { email, password } = ctx.request.body || {};
  if (!email || !password) {
    return sendError(ctx, 400, 'VALIDATION_ERROR', 'Email và mật khẩu là bắt buộc.');
  }

  const user = await findAdminUser(strapi, email);
  if (!user) {
    return sendError(ctx, 401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  }

  const passwordOk = await validateAdminPassword(strapi, user, password);
  if (!passwordOk) {
    return sendError(ctx, 401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
  }

  const payload = {
    sub: user.id,
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    exp: Date.now() + SESSION_TTL_MS,
  };

  setSessionCookie(ctx, payload);
  ctx.body = { user: publicUser(payload) };
}

function publicUser(payload) {
  return {
    id: payload.sub,
    email: payload.email,
    firstname: payload.firstname || '',
    lastname: payload.lastname || '',
  };
}

async function requireSession(ctx) {
  const payload = verify(ctx.cookies.get(COOKIE_NAME));
  if (!payload) {
    sendError(ctx, 401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập lại.');
    return null;
  }
  ctx.state.adminUiUser = payload;
  return payload;
}

async function me(ctx) {
  const payload = await requireSession(ctx);
  if (!payload) return;
  ctx.body = { user: publicUser(payload) };
}

async function logout(ctx) {
  clearSessionCookie(ctx);
  ctx.body = { ok: true };
}

module.exports = {
  login,
  me,
  logout,
  requireSession,
};
