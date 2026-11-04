import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const directory = "/opt/cursor/artifacts/screenshots";

test.beforeAll(() => {
  mkdirSync(directory, { recursive: true });
});

test("记录接口状态：未授权、限流和设置", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route("**/api/status", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ auth: "unauthorized", error: "unauthorized" }),
    });
  });
  await page.goto("/profile");
  await expect(page.getByText("未授权")).toBeVisible();
  await page.screenshot({ path: `${directory}/api-unauthorized.png` });

  await page.route("**/api/status", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ auth: "rate_limited", error: "rate_limited" }),
    });
  });
  await page.reload();
  await expect(page.getByText("请求过于频繁")).toBeVisible();
  await page.screenshot({ path: `${directory}/api-rate-limited.png` });

  await page.route("**/api/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ auth: "connected", paidApi: "locked", service: "lvxu" }),
    });
  });
  await page.reload();
  await expect(page.getByText("已连接")).toBeVisible();
  await page.screenshot({ path: `${directory}/api-settings.png` });
});
