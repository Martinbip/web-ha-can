status: DONE

files changed:
- dha-cms/src/api/admin-ui/routes/admin-ui.js
- dha-cms/src/api/admin-ui/controllers/admin-ui.js
- dha-cms/src/api/admin-ui/services/auth.js
- dha-cms/src/api/admin-ui/services/errors.js
- dha-cms/config/middlewares.js
- tests/admin-ui-config.test.js

commits made:
- 757c45957ace51116375884b26f37fbb9cf8a95b feat: add custom admin auth bridge

tests run with results:
- npm test: RED before implementation, failed as expected because dha-cms/src/api/admin-ui/services/auth.js did not exist.
- npm test: PASS after implementation and final verification, 13 tests passed, 0 failed.

self-review notes:
- Implemented only Task 2 files from the brief.
- Admin UI auth routes use config auth: false so Strapi Content API auth is bypassed for these bridge endpoints.
- Session cookie settings include httpOnly: true, sameSite: 'lax', production-only secure, path '/', overwrite, and 8-hour maxAge.
- Auth service uses ADMIN_UI_SESSION_SECRET with ADMIN_JWT_SECRET fallback and does not read Cloudinary secrets.
- CORS config now allows credentials.

---

status: DONE - review fixes

files changed:
- dha-cms/src/api/admin-ui/routes/admin-ui.js
- dha-cms/src/api/admin-ui/services/auth.js
- dha-cms/config/middlewares.js
- tests/admin-ui-config.test.js

commits made:
- a702467525af30be003ef07b51cc699baef263c0 fix: harden custom admin auth bridge

tests run with results:
- npm test: RED before fix, failed as expected on the three new static review tests for login rate limiting, safe auth signature comparison, and removal of credentialed CORS for Origin: null.
- npm test: PASS after fix, 16 tests passed, 0 failed.
- node malformed-token smoke: PASS, 9 malformed or expired session cookie cases returned null through requireSession without throwing.

self-review notes:
- Login route now applies the existing route middleware style with global::rate-limit, windowMs: 15 * 60 * 1000, and max: 5.
- verify(token) rejects missing, malformed, extra-piece, bad-signature, invalid JSON, missing exp, and expired exp tokens by returning null.
- Signature comparison uses a helper that checks Buffer lengths before crypto.timingSafeEqual so length mismatches cannot throw.
- Credentialed CORS no longer allowlists the literal null origin, while localhost, 127.0.0.1, and FRONTEND_URL remain supported.
