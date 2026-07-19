import { defineConfig, devices } from '@playwright/test'

// Mobile CI config for SecureGate. Boots the built preview server and runs the
// mobile smoke spec on a phone viewport. Requires `@playwright/test` + browsers
// to be installed; scripts/verify-mobile-ci.cjs skips honestly when they are not.
const PORT = Number(process.env.PW_PORT || 4599)

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: `vite preview --port ${PORT} --host 127.0.0.1`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 30_000,
    env: { PORT: String(PORT), BASE_PATH: '/', BACKEND_PORT: process.env.BACKEND_PORT || '3001' },
  },
})
