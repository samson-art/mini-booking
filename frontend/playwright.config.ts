import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  // Тесты работают с одной базой и общим rate limit — только по очереди
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    // Пояс браузера отличается от пояса расписания — время на странице всё равно московское
    timezoneId: 'America/New_York',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 375, height: 740 } },
      // Гонку (E2) гоняем только в desktop: от вьюпорта она не зависит, а лимит запросов общий
      grepInvert: /E2:/,
    },
  ],
})
