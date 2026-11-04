import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "https://127.0.0.1:43128",
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  },
  webServer: {
    command:
      "npm run build && npm run preview -- --host 127.0.0.1 --port 43128 --strictPort",
    url: "https://127.0.0.1:43128",
    ignoreHTTPSErrors: true,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
