'use strict';

const http = require('node:http');

// Dựng app Koa trên cổng ngẫu nhiên để test gọi bằng fetch như trình duyệt.
async function startServer(app) {
  const server = http.createServer(app.callback());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = { startServer };