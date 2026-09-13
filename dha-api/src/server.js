'use strict';

const { loadConfig } = require('./config');
const { createSanityClient, assertDatasetPrivate } = require('./sanity/client');
const { createSanityStore } = require('./sanity/store');
const { createApp } = require('./app');

async function main() {
  const config = loadConfig();
  await assertDatasetPrivate(config.sanity);
  const store = createSanityStore({ client: createSanityClient(config.sanity) });
  const app = createApp({ store, config });
  app.listen(config.port, config.host, () => {
    console.log(`[dha-api] nghe ${config.host}:${config.port} — dataset ${config.sanity.dataset}`);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[dha-api] không khởi động được: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main };
