import { defineConfig, devices } from "@playwright/test";

const shared = {
  baseURL: "https://127.0.0.1:43128",
  ignoreHTTPSErrors: true,
};

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  webServer: {
    command:
      "npm run build && npm run preview -- --host 127.0.0.1 --port 43128 --strictPort",
    url: "https://127.0.0.1:43128",
    ignoreHTTPSErrors: true,
    timeout: 180_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "iphone",
      testMatch: /stage12-.*\.spec\.ts/,
      use: { ...shared, ...devices["iPhone 14"] },
    },
    {
      name: "desktop",
      testMatch: /.*\.spec\.ts/,
      testIgnore: /stage12-iphone\.spec\.ts/,
      use: {
        ...shared,
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
});
