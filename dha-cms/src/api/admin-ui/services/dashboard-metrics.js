'use strict';

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDayLabel(date) {
  const d = new Date(date);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

function buildDateBuckets(now, dayCount) {
  const base = new Date(now);
  const buckets = [];
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    buckets.push({ key: toDayKey(d), label: toDayLabel(d) });
  }
  return buckets;
}

function countRecordsByDay(records, buckets) {
  const index = new Map(buckets.map((bucket, i) => [bucket.key, i]));
  const counts = new Array(buckets.length).fill(0);
  for (const record of records || []) {
    if (!record || !record.createdAt) continue;
    const key = toDayKey(record.createdAt);
    if (index.has(key)) counts[index.get(key)] += 1;
  }
  return counts;
}

function toContactLead(record) {
  return {
    documentId: record.documentId,
    name: record.name,
    service: record.service,
    createdAt: record.createdAt,
  };
}

function toOrderLead(record) {
  return {
    documentId: record.documentId,
    customerName: record.customer_name,
    productName: record.product_name,
    quantity: record.quantity,
    createdAt: record.createdAt,
  };
}

module.exports = {
  buildDateBuckets,
  countRecordsByDay,
  toContactLead,
  toOrderLead,
};
