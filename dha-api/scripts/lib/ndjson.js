'use strict';

// Định dạng mà `sanity datasets import` đọc: mỗi dòng một document.
function toNdjson(docs) {
  return docs.map((doc) => JSON.stringify(doc)).join('\n') + '\n';
}

module.exports = { toNdjson };
