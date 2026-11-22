import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Браузер видит один origin: запросы /api проксируются в backend, CORS не нужен
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8000',
        // Адрес клиента в X-Forwarded-For: backend считает rate limit по клиенту, а не по прокси
        xfwd: true,
      },
    },
    // Контейнер e2e открывает страницу по имени сервиса
    allowedHosts: ['frontend'],
  },
})
