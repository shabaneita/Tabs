import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against `next start` + the local Supabase-compatible stack
 * (scripts/local-stack/start.sh). iPhone 15-class viewport, Arabic locale,
 * Dubai time zone.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ar-AE",
    timezoneId: "Asia/Dubai",
    trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  projects: [
    {
      name: "iphone-15",
      use: {
        ...devices["iPhone 15"],
        // WebKit isn't installed in this environment; Chromium with iPhone metrics.
        browserName: "chromium",
        defaultBrowserType: "chromium",
      },
    },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
