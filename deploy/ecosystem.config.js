module.exports = {
  apps: [
    {
      name: 'dha-api',
      cwd: '/var/www/dha-api',
      script: 'src/server.js',
      node_args: '--env-file=.env',
      // Đúng một tiến trình: cache đọc trong dha-api được xoá tại chỗ mỗi lần
      // ghi, nhiều tiến trình sẽ phục vụ dữ liệu cũ sau khi admin sửa.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      // Không đặt PORT ở đây: --env-file không ghi đè biến đã có, cổng phải
      // lấy từ .env để chạy song song ở 1338 trước ngày chuyển.
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/pm2/dha-api-error.log',
      out_file: '/var/log/pm2/dha-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
