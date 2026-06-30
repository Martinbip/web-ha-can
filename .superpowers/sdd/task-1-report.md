status: DONE_WITH_CONCERNS

files changed:
- dha-cms/src/api/admin-ui/services/resource-config.js
- tests/admin-ui-config.test.js

commits made:
- 95a0363 feat: add admin resource registry

tests run with results:
- npm test: PASS, 8/8 tests passed
- node --test tests/admin-ui-config.test.js: PASS, 2/2 tests passed
- RED check: node --test tests/admin-ui-config.test.js failed before implementation with ENOENT for missing dha-cms/src/api/admin-ui/services/resource-config.js

self-review notes:
- Implemented only Task 1 registry/test files from the brief, then committed only those two files.
- Exported RESOURCE_CONFIG, getResourceConfig(type), listResourceConfigs(), and isDraftEnabled(type).
- Resource aliases, Vietnamese labels, editableFields, listFields, and draft settings match the brief values; bare aliases were quoted so the required source-level whitelist test can detect them.
- Concern: the root npm test script currently runs only tests/regression.test.js, so tests/admin-ui-config.test.js is not exercised by npm test unless invoked directly.

---

fix report: review findings addressed

files changed:
- dha-cms/src/api/admin-ui/services/resource-config.js
- package.json
- tests/admin-ui-config.test.js
- tests/regression.test.js

commit id:
- baf1d960fc695126cab2d2ded1b49f5d66969c96 fix: address admin resource registry review

tests run with results:
- RED check: node --test tests/admin-ui-config.test.js failed with the expected own-key whitelist and project schema assertions before implementation.
- npm test: PASS, 12/12 tests passed.

self-review notes:
- getResourceConfig(type) now uses Object.prototype.hasOwnProperty.call so inherited properties such as __proto__, constructor, and toString return null.
- Root npm test now runs both tests/regression.test.js and tests/admin-ui-config.test.js, and the regression assertion was updated to the new required script.
- Project config now whitelists the existing Task 1 schema field image with Vietnamese label Ảnh dự án, without adding schema fields.
- Hero slide and site-setting hero editor labels are Vietnamese.
