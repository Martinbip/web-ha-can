// CHỈ DÙNG KHI ROLLBACK về Strapi trong 14 ngày sau khi chuyển (xem
// docs/runbooks/2026-09-strapi-to-sanity-cutover.md). Xoá ở Task 15.
module.exports = {
  apps: [
    {
      name: 'dha-cms',
      cwd: '/var/www/dha-cms',
      script: './node_modules/.bin/strapi',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 1337,
      },
      error_file: '/var/log/pm2/dha-cms-error.log',
      out_file: '/var/log/pm2/dha-cms-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
