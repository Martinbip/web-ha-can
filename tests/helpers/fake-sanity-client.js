'use strict';

// Client Sanity giả trong bộ nhớ: đủ đúng một truy vấn mà store dùng
// (`*[_type == $type]`) và các mutation trong transaction. Transaction áp dụng
// trọn gói hoặc không gì cả, như Sanity thật.
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeSanityClient(initialDocs = []) {
  let revision = 0;
  let docs = new Map();
  const stats = { fetches: 0, commits: 0 };

  function stamp(doc, existing) {
    revision += 1;
    const at = new Date(Date.UTC(2026, 1, 1, 0, 0, revision)).toISOString();
    return { ...doc, _createdAt: (existing && existing._createdAt) || at, _updatedAt: at, _rev: `r${revision}` };
  }

  for (const doc of initialDocs) docs.set(doc._id, stamp(clone(doc)));

  return {
    stats,
    get docs() {
      return docs;
    },

    async fetch(query, params = {}) {
      stats.fetches += 1;
      if (query !== '*[_type == $type]') {
        throw new Error(`Truy vấn chưa hỗ trợ trong client giả: ${query}`);
      }
      return [...docs.values()].filter((doc) => doc._type === params.type).map(clone);
    },

    transaction() {
      const ops = [];
      const tx = {
        create(doc) { ops.push(['create', clone(doc)]); return tx; },
        createOrReplace(doc) { ops.push(['createOrReplace', clone(doc)]); return tx; },
        createIfNotExists(doc) { ops.push(['createIfNotExists', clone(doc)]); return tx; },
        delete(id) { ops.push(['delete', id]); return tx; },
        patch(id, patch) { ops.push(['patch', id, clone(patch)]); return tx; },
        async commit() {
          const next = new Map(docs);
          for (const [op, subject, patch] of ops) {
            if (op === 'create') {
              if (next.has(subject._id)) throw new Error(`Document already exists: ${subject._id}`);
              next.set(subject._id, stamp(subject));
            } else if (op === 'createOrReplace') {
              next.set(subject._id, stamp(subject, next.get(subject._id)));
            } else if (op === 'createIfNotExists') {
              if (!next.has(subject._id)) next.set(subject._id, stamp(subject));
            } else if (op === 'delete') {
              next.delete(subject);
            } else if (op === 'patch') {
              const current = next.get(subject);
              if (!current) throw new Error(`Document not found: ${subject}`);
              next.set(subject, stamp({ ...current, ...patch.set }, current));
            }
          }
          docs = next;
          stats.commits += 1;
          return { transactionId: `tx${stats.commits}`, results: ops.map(() => ({})) };
        },
      };
      return tx;
    },
  };
}

module.exports = { createFakeSanityClient };
