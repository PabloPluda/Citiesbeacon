import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/posts': {
        target: 'https://cityheroacademy.substack.com',
        changeOrigin: true,
        rewrite: () => '/api/v1/posts?limit=3',
      },
    },
  },
})
