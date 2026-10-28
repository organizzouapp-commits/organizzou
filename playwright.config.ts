import { defineConfig } from "@playwright/test"

// Smoke sweep: `PROTOTYPE_BYPASS_AUTH=1 NEXT_DIST_DIR=.next-preview npx next dev -p 3100`, then `npx playwright test`.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 30 * 60_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.BASE ?? "http://localhost:3100", trace: "off" },
})
