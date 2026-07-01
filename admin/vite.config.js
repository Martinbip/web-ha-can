import { defineConfig } from 'vite';

export default defineConfig({
  base: '/admin/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:1337',
        changeOrigin: true,
      },
    },
  },
});
