'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

// Hợp đồng tối thiểu mà service admin-ui dựa vào. makeStore() trả store rỗng.
function runDocumentStoreContract(label, makeStore) {
  test(`[${label}] tạo mới: góc nhìn nháp có publishedAt null, web chưa thấy`, async () => {
    const news = makeStore().documents('news');
    const created = await news.create({ data: { title: 'Giá đồng', slug: 'gia-dong' } });
    assert.ok(created.documentId);
    assert.equal(created.publishedAt, null);
    assert.equal((await news.findOne({ documentId: created.documentId })).title, 'Giá đồng');
    assert.equal(await news.findOne({ documentId: created.documentId, status: 'published' }), null);
    assert.deepEqual(await news.findMany({ status: 'published' }), []);
    assert.equal(await news.count({}), 1);
    assert.equal(await news.count({ filters: { publishedAt: { $null: true } } }), 1);
  });

  test(`[${label}] xuất bản: web thấy, góc nhìn nháp vẫn publishedAt null`, async () => {
    const news = makeStore().documents('news');
    const { documentId } = await news.create({ data: { title: 'A', slug: 'a' } });
    const published = await news.publish({ documentId });
    assert.equal(typeof published.publishedAt, 'string');

    const [row] = await news.findMany({ status: 'published' });
    assert.equal(row.documentId, documentId);
    assert.equal(row.title, 'A');
    assert.equal((await news.findOne({ documentId })).publishedAt, null);
    assert.equal(await news.count({ filters: { publishedAt: { $null: true } } }), 0);
  });

  test(`[${label}] sửa rồi xuất bản lại thì web thấy nội dung mới`, async () => {
    const news = makeStore().documents('news');
    const { documentId } = await news.create({ data: { title: 'Cũ', slug: 'a' } });
    await news.publish({ documentId });
    const updated = await news.update({ documentId, data: { title: 'Mới' } });
    assert.equal(updated.title, 'Mới');
    await news.publish({ documentId });
    assert.equal((await news.findOne({ documentId, status: 'published' })).title, 'Mới');
    assert.equal(await news.count({}), 1, 'không đếm đôi nháp + xuất bản');
  });

  test(`[${label}] gỡ xuất bản: web mất, admin còn nguyên nội dung`, async () => {
    const news = makeStore().documents('news');
    const { documentId } = await news.create({ data: { title: 'A', slug: 'a' } });
    await news.publish({ documentId });
    await news.unpublish({ documentId });
    assert.equal(await news.findOne({ documentId, status: 'published' }), null);
    assert.equal((await news.findOne({ documentId })).title, 'A');
    assert.equal(await news.count({ filters: { publishedAt: { $null: true } } }), 1);
  });

  test(`[${label}] xoá: mất ở mọi góc nhìn`, async () => {
    const news = makeStore().documents('news');
    const { documentId } = await news.create({ data: { title: 'A', slug: 'a' } });
    await news.publish({ documentId });
    await news.delete({ documentId });
    assert.equal(await news.findOne({ documentId }), null);
    assert.equal(await news.count({}), 0);
  });

  test(`[${label}] lọc, sắp xếp, phân trang, chọn trường`, async () => {
    const news = makeStore().documents('news');
    for (const title of ['Giá Đồng', 'Giá nhôm', 'Thiếc', 'Giá chì']) {
      await news.create({ data: { title, slug: title } });
    }
    const filters = { $or: [{ title: { $containsi: 'giá' } }] };
    assert.equal(await news.count({ filters }), 3);

    const rows = await news.findMany({ filters, sort: { title: 'desc' }, start: 1, limit: 1, fields: ['title'] });
    assert.equal(rows.length, 1);
    // So theo code unit như SQLite: 'Đ' (U+0110) > 'n' > 'c' → Đồng, nhôm, chì.
    assert.equal(rows[0].title, 'Giá nhôm');
    assert.deepEqual(Object.keys(rows[0]).sort(), ['documentId', 'id', 'title']);
  });

  test(`[${label}] không có bản ghi thì findOne trả null`, async () => {
    assert.equal(await makeStore().documents('news').findOne({ documentId: 'khong-co' }), null);
  });

  test(`[${label}] $gte bỏ qua bản ghi không có giá trị (không lấy 1970 làm mặc định)`, async () => {
    const news = makeStore().documents('news');
    await news.create({ data: { title: 'Có ngày', slug: 'co-ngay', date: '2026-01-02' } });
    await news.create({ data: { title: 'Không ngày', slug: 'khong-ngay' } });
    assert.equal(await news.count({ filters: { date: { $gte: '1960-01-01' } } }), 1);
  });
}

module.exports = { runDocumentStoreContract };
