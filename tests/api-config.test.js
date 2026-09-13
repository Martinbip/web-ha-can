'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { loadConfig } = require('../dha-api/src/config');
const { setStore, getStore } = require('../dha-api/src/sanity/store-registry');

const BASE_ENV = {
  SANITY_PROJECT_ID: 'abc123',
  SANITY_DATASET: 'staging',
  SANITY_API_TOKEN: 'sk-test',
  ADMIN_UI_SESSION_SECRET: 'bi-mat',
};

test('thiếu biến bắt buộc thì báo rõ tên từng biến', () => {
  assert.throws(
    () => loadConfig({}),
    (err) => ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_API_TOKEN', 'ADMIN_UI_SESSION_SECRET']
      .every((name) => err.message.includes(name)),
  );
});

test('giá trị mặc định: cổng 1337, không tin proxy ngoài production', () => {
  const config = loadConfig(BASE_ENV);
  assert.equal(config.port, 1337);
  assert.equal(config.isBehindProxy, false);
  assert.deepEqual(config.sanity, { projectId: 'abc123', dataset: 'staging', token: 'sk-test', apiVersion: '2025-02-19' });
});

test('production tin proxy mặc định, IS_BEHIND_PROXY ghi đè được', () => {
  assert.equal(loadConfig({ ...BASE_ENV, NODE_ENV: 'production' }).isBehindProxy, true);
  assert.equal(loadConfig({ ...BASE_ENV, NODE_ENV: 'production', IS_BEHIND_PROXY: 'false' }).isBehindProxy, false);
  assert.equal(loadConfig({ ...BASE_ENV, IS_BEHIND_PROXY: 'true' }).isBehindProxy, true);
});

test('PORT không phải số thì báo lỗi thay vì nghe cổng rác', () => {
  assert.throws(() => loadConfig({ ...BASE_ENV, PORT: 'abc' }), /PORT/);
});

test('getStore báo lỗi rõ khi chưa khởi tạo, setStore(null) gỡ store', () => {
  setStore(null);
  assert.throws(() => getStore(), /setStore/);
  const fake = { documents() {} };
  setStore(fake);
  assert.equal(getStore(), fake);
  setStore(null);
});
