'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EXPORT_TYPES,
  toSanityDocuments,
  adminUsersToDocs,
  planProjectImage,
  summarize,
  legacyImagePublicId,
  buildReport,
} = require('../dha-api/scripts/lib/strapi-export');
const { PUBLIC_COLLECTIONS, PUBLIC_SINGLES } = require('../dha-api/src/routes/public');

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-02-01T00:00:00.000Z';

function row(documentId, fields, extra = {}) {
  return { id: 7, documentId, createdAt: T1, updatedAt: T2, publishedAt: null, locale: null, ...fields, ...extra };
}

test('xuất đủ 15 loại: mọi đường dẫn công khai + 2 form', () => {
  const paths = EXPORT_TYPES.map((item) => item.path).sort();
  const expected = [...Object.keys(PUBLIC_COLLECTIONS), ...Object.keys(PUBLIC_SINGLES), 'contact-inquiries', 'order-requests'].sort();
  assert.deepEqual(paths, expected);
});

test('bài chỉ có bản xuất bản (do seed cũ tạo): một document, giữ publishedAt thật', () => {
  const docs = toSanityDocuments({ type: 'news', draftRows: [], publishedRows: [row('abc', { title: 'A' }, { publishedAt: T2 })] });
  assert.deepEqual(docs, [{ _id: 'abc', _type: 'news', title: 'A', createdAt: T1, publishedAt: T2 }]);
});

test('nháp giống bản xuất bản thì không tạo drafts.*; khác thì có', () => {
  const published = [row('abc', { title: 'A' }, { publishedAt: T2 })];
  const same = toSanityDocuments({ type: 'news', draftRows: [row('abc', { title: 'A' }, { id: 8 })], publishedRows: published });
  assert.deepEqual(same.map((doc) => doc._id), ['abc']);

  const changed = toSanityDocuments({ type: 'news', draftRows: [row('abc', { title: 'A (đang sửa)' })], publishedRows: published });
  assert.deepEqual(changed.map((doc) => doc._id), ['abc', 'drafts.abc']);
  const draft = changed.find((doc) => doc._id === 'drafts.abc');
  assert.equal(draft.title, 'A (đang sửa)');
  assert.ok(!('publishedAt' in draft), 'nháp không mang publishedAt');
});

test('bài chưa từng xuất bản chỉ có drafts.*', () => {
  const docs = toSanityDocuments({ type: 'news', draftRows: [row('xyz', { title: 'Nháp' })], publishedRows: [] });
  assert.deepEqual(docs.map((doc) => doc._id), ['drafts.xyz']);
});

test('type không có nháp và singleton', () => {
  const [contact] = toSanityDocuments({ type: 'contactInquiry', publishedRows: [row('c1', { name: 'Khách', status: 'new' }, { publishedAt: T1 })] });
  assert.deepEqual(contact, { _id: 'c1', _type: 'contactInquiry', name: 'Khách', status: 'new', createdAt: T1, publishedAt: T1 });

  const [setting] = toSanityDocuments({ type: 'siteSetting', publishedRows: [row('s1', { hotline: '0900' })] });
  assert.equal(setting._id, 'siteSetting');
  assert.equal(setting.publishedAt, T1, 'thiếu publishedAt thì lấy createdAt');
});

test('bỏ trường meta và trường media của Strapi', () => {
  const [doc] = toSanityDocuments({
    type: 'project',
    publishedRows: [row('p1', {
      name: 'Dự án',
      createdBy: { id: 1 },
      localizations: [],
      image: { id: 3, url: '/uploads/a.jpg', mime: 'image/jpeg' },
    }, { publishedAt: T2 })],
  });
  assert.deepEqual(Object.keys(doc).sort(), ['_id', '_type', 'createdAt', 'name', 'publishedAt']);
});

test('ảnh dự án kiểu cũ: URL tuyệt đối dùng thẳng, /uploads cần upload lại, đã có Cloudinary thì bỏ qua', () => {
  const absolute = row('p1', { image: { url: 'https://res.cloudinary.com/x/image/upload/v1/dha/a.jpg', mime: 'image/jpeg', provider_metadata: { public_id: 'dha/a' } } });
  assert.deepEqual(planProjectImage(absolute), {
    patch: { cloudinary_image_url: 'https://res.cloudinary.com/x/image/upload/v1/dha/a.jpg', cloudinary_public_id: 'dha/a' },
  });
  assert.deepEqual(planProjectImage(row('p2', { image: { url: '/uploads/b.jpg', mime: 'image/jpeg' } })), { upload: '/uploads/b.jpg' });
  assert.equal(planProjectImage(row('p3', { cloudinary_image_url: 'https://x', image: { url: '/uploads/c.jpg', mime: 'image/jpeg' } })), null);
  assert.equal(planProjectImage(row('p4', {})), null);
});

test('admin user: id có dấu chấm, chép nguyên hash, khoá nếu blocked, bỏ người không có mật khẩu', () => {
  const { docs, skipped } = adminUsersToDocs([
    { document_id: 'li6gi603nnjia9695f8sogq2', email: 'Admin@DHA.vn', firstname: 'A', lastname: null, password: '$2a$10$abc', is_active: 1, blocked: 0, created_at: 1767225600000 },
    { document_id: 'u2', email: 'b@dha.vn', firstname: null, lastname: null, password: '$2a$10$def', is_active: 1, blocked: 1, created_at: '2026-01-01 00:00:00' },
    { document_id: 'u3', email: 'c@dha.vn', password: null, is_active: 1, blocked: 0, created_at: null },
  ]);
  assert.deepEqual(docs[0], {
    _id: 'adminUser.li6gi603nnjia9695f8sogq2',
    _type: 'adminUser',
    email: 'admin@dha.vn',
    passwordHash: '$2a$10$abc',
    firstname: 'A',
    lastname: '',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(docs[1].isActive, false);
  assert.deepEqual(skipped, ['c@dha.vn']);
});

test('tóm tắt đếm theo type, tách nháp và bản xuất bản', () => {
  assert.deepEqual(summarize([
    { _id: 'a', _type: 'news' },
    { _id: 'drafts.a', _type: 'news' },
    { _id: 'p', _type: 'product' },
  ]), { news: { published: 1, drafts: 1 }, product: { published: 1, drafts: 0 } });
});

test('legacyImagePublicId tạo id cố định từ documentId', () => {
  assert.equal(legacyImagePublicId('p2'), 'project-p2');
  assert.equal(legacyImagePublicId('p2'), 'project-p2', 'ổn định qua các lần gọi');
});

test('buildReport trả về báo cáo đầy đủ với đếm media', () => {
  const docs = [
    { _id: 'a', _type: 'news' },
    { _id: 'drafts.a', _type: 'news' },
    { _id: 'p', _type: 'product' },
  ];
  const media = [{ from: '/uploads/b.jpg', publicId: 'dha/legacy/project-p2' }];
  const report = buildReport({ file: 'out/migrate.ndjson', docs, adminUsersSkipped: [], media });
  assert.equal(report.file, 'out/migrate.ndjson');
  assert.equal(report.total, 3);
  assert.deepEqual(report.byType, { news: { published: 1, drafts: 1 }, product: { published: 1, drafts: 0 } });
  assert.deepEqual(report.adminUsersSkipped, []);
  assert.equal(report.mediaMigrated, 1);
  assert.deepEqual(report.mediaFiles, ['/uploads/b.jpg']);
});
