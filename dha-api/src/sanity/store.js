'use strict';

const crypto = require('node:crypto');

const { getTypeOptions } = require('./types');
const { createTypeCache } = require('./cache');
const { matchesFilters, sortEntries, pickFields } = require('./query-engine');

// Dựng lại đúng phần Document Service của Strapi 5 mà khu admin-ui gọi, trên
// Sanity. Nháp nằm ở `drafts.<id>`, bản xuất bản ở `<id>` — cùng mô hình cặp
// nháp/xuất bản của Strapi. Xem spec mục 4.

const DRAFT_PREFIX = 'drafts.';
const RELEASE_PREFIX = 'versions.';
const SYSTEM_KEYS = new Set(['_id', '_type', '_rev', '_createdAt', '_updatedAt']);
// Trường do store quản lý: người gọi không được ghi đè.
const MANAGED_KEYS = new Set(['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt']);
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DEFAULT_LIMIT = 100;
const LARGE_TYPE_WARNING = 5000;
const TYPE_QUERY = '*[_type == $type]';

// Cùng dạng documentId của Strapi 5: 24 ký tự a-z0-9.
function newDocumentId() {
  let id = '';
  for (const byte of crypto.randomBytes(24)) id += ID_ALPHABET[byte % ID_ALPHABET.length];
  return id;
}

function documentIdOf(sanityId) {
  return sanityId.startsWith(DRAFT_PREFIX) ? sanityId.slice(DRAFT_PREFIX.length) : sanityId;
}

function stripSystem(doc) {
  const out = {};
  for (const [key, value] of Object.entries(doc)) {
    if (!SYSTEM_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function withoutPublishedAt(doc) {
  const { publishedAt, ...rest } = stripSystem(doc);
  return rest;
}

function cleanInput(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (key.startsWith('_') || MANAGED_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

// publishedAt === undefined → lấy giá trị lưu trong document.
function toEntry(doc, publishedAt) {
  const documentId = documentIdOf(doc._id);
  return {
    ...stripSystem(doc),
    id: documentId,
    documentId,
    createdAt: doc.createdAt || doc._createdAt || null,
    updatedAt: doc._updatedAt || null,
    publishedAt: publishedAt === undefined ? doc.publishedAt ?? null : publishedAt,
  };
}

function groupVersions(docs) {
  const versions = new Map();
  for (const doc of docs) {
    if (doc._id.startsWith(RELEASE_PREFIX)) continue;
    const documentId = documentIdOf(doc._id);
    const pair = versions.get(documentId) || { draft: null, published: null };
    if (doc._id.startsWith(DRAFT_PREFIX)) pair.draft = doc;
    else pair.published = doc;
    versions.set(documentId, pair);
  }
  return versions;
}

function createSanityStore({ client, ttlMs } = {}) {
  const warned = new Set();
  const cache = createTypeCache({
    ttlMs,
    load: async (type) => {
      const versions = groupVersions(await client.fetch(TYPE_QUERY, { type }));
      if (versions.size > LARGE_TYPE_WARNING && !warned.has(type)) {
        warned.add(type);
        console.warn(`[store] ${type} có ${versions.size} document — xem lại việc lọc trong bộ nhớ (spec mục 4).`);
      }
      return versions;
    },
  });

  async function commit(build) {
    const tx = client.transaction();
    build(tx);
    await tx.commit({ visibility: 'sync' });
    cache.invalidate();
  }

  function documents(type) {
    const options = getTypeOptions(type);

    const draftView = (pair) =>
      options.drafts ? toEntry(pair.draft || pair.published, null) : toEntry(pair.published || pair.draft);

    const publishedView = (pair) => {
      if (options.drafts) return pair.published ? toEntry(pair.published) : null;
      const doc = pair.published || pair.draft;
      return doc ? toEntry(doc) : null;
    };

    // Nội dung như góc nhìn nháp nhưng mang publishedAt thật — để lọc/đếm
    // "chưa xuất bản" cho đúng.
    const stateView = (pair) => {
      if (!options.drafts) return toEntry(pair.published || pair.draft);
      const publishedAt = pair.published ? pair.published.publishedAt ?? pair.published._updatedAt : null;
      return toEntry(pair.draft || pair.published, publishedAt);
    };

    async function loadPair(documentId) {
      return (await cache.get(type)).get(documentId) || null;
    }

    async function candidates(status) {
      const pairs = [...(await cache.get(type)).values()];
      if (status === 'published') {
        return pairs.map((pair) => ({ pair, view: publishedView(pair) })).filter((item) => item.view);
      }
      return pairs.map((pair) => ({ pair, view: stateView(pair) }));
    }

    function requireDrafts(action) {
      if (!options.drafts) throw new Error(`${type} không có nháp/xuất bản — không ${action} được.`);
    }

    const api = {
      async findMany({ fields, filters, sort, start = 0, limit = DEFAULT_LIMIT, status = 'draft' } = {}) {
        const matched = (await candidates(status)).filter((item) => matchesFilters(item.view, filters));
        const pairOf = new Map(matched.map((item) => [item.view, item.pair]));
        const ordered = sortEntries(matched.map((item) => item.view), sort);
        return ordered.slice(start, start + limit).map((view) =>
          pickFields(status === 'published' ? view : draftView(pairOf.get(view)), fields),
        );
      },

      async findOne({ documentId, fields, status = 'draft' } = {}) {
        const pair = await loadPair(documentId);
        if (!pair) return null;
        const view = status === 'published' ? publishedView(pair) : draftView(pair);
        return view ? pickFields(view, fields) : null;
      },

      async count({ filters, status = 'draft' } = {}) {
        return (await candidates(status)).filter((item) => matchesFilters(item.view, filters)).length;
      },

      async create({ data } = {}) {
        const documentId = options.singletonId || `${options.idPrefix || ''}${newDocumentId()}`;
        const now = new Date().toISOString();
        const doc = { ...cleanInput(data), _type: type, createdAt: now };
        if (options.drafts) {
          doc._id = DRAFT_PREFIX + documentId;
        } else {
          doc._id = documentId;
          doc.publishedAt = now;
        }
        await commit((tx) => tx.create(doc));
        return api.findOne({ documentId });
      },

      async update({ documentId, data } = {}) {
        const pair = await loadPair(documentId);
        if (!pair) throw new Error(`Không có bản ghi ${documentId}`);
        const changes = cleanInput(data);
        const hasChanges = Object.keys(changes).length > 0;
        const needsDraft = options.drafts && !pair.draft;

        if (needsDraft || hasChanges) {
          await commit((tx) => {
            if (options.drafts) {
              const draftId = DRAFT_PREFIX + documentId;
              // Document Service của Strapi chỉ ghi vào nháp; tạo nháp từ bản
              // xuất bản trước rồi mới sửa, để web giữ bản cũ tới khi xuất bản.
              if (needsDraft) tx.createIfNotExists({ ...withoutPublishedAt(pair.published), _id: draftId, _type: type });
              if (hasChanges) tx.patch(draftId, { set: changes });
            } else {
              tx.patch((pair.published || pair.draft)._id, { set: changes });
            }
          });
        }
        return api.findOne({ documentId });
      },

      async delete({ documentId } = {}) {
        await commit((tx) => {
          tx.delete(documentId);
          tx.delete(DRAFT_PREFIX + documentId);
        });
        return { documentId };
      },

      async publish({ documentId } = {}) {
        requireDrafts('xuất bản');
        const pair = await loadPair(documentId);
        if (!pair) return null;
        const source = pair.draft || pair.published;
        const publishedAt = new Date().toISOString();
        await commit((tx) => {
          tx.createOrReplace({ ...stripSystem(source), _id: documentId, _type: type, publishedAt });
          if (pair.draft) tx.delete(DRAFT_PREFIX + documentId);
        });
        return api.findOne({ documentId, status: 'published' });
      },

      async unpublish({ documentId } = {}) {
        requireDrafts('gỡ xuất bản');
        const pair = await loadPair(documentId);
        if (!pair) return null;
        if (pair.published) {
          await commit((tx) => {
            if (!pair.draft) tx.create({ ...withoutPublishedAt(pair.published), _id: DRAFT_PREFIX + documentId, _type: type });
            tx.delete(documentId);
          });
        }
        return api.findOne({ documentId });
      },
    };

    return api;
  }

  return { documents };
}

module.exports = { createSanityStore, newDocumentId, DRAFT_PREFIX };
