import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const directory = "docs/stage08/screenshots";

test.beforeAll(() => {
  mkdirSync(directory, { recursive: true });
});

test("核对地点并只显示高德返回的距离", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("lvxu-owner-key", "device-key");
  });

  await page.route("**/api/map/config", async (route) => {
    await route.fulfill({
      status: 501,
      contentType: "application/json",
      body: JSON.stringify({ error: "not_configured", message: "高德密钥还没配置。" }),
    });
  });

  await page.goto("/trips/trip-kyoto");
  await expect(page.getByText("未核实").first()).toBeVisible();
  await page.screenshot({ path: `${directory}/unverified.png` });

  await page.getByRole("button", { name: "展开地图" }).click();
  await expect(page.getByText("高德密钥还没配置。")).toBeVisible();
  await page.screenshot({ path: `${directory}/not-configured.png` });

  await page.unroute("**/api/map/config");
  await page.route("**/api/map/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ key: "js-key", serviceHost: "/_AMapService", version: "2.0" }),
    });
  });
  await page.route("**/api/map/poi/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pois: [
          {
            id: "B001",
            name: "清水寺",
            address: "东山区清水",
            lng: 135.785,
            lat: 34.995,
          },
        ],
      }),
    });
  });
  await page.route("**/api/map/route**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        fetchedAt: Date.now(),
        route: {
          mode: "walking",
          distanceMeters: 860,
          durationSeconds: 720,
          polyline: "135.785,34.995;135.786,34.996",
        },
      }),
    });
  });
  await page.route("https://webapi.amap.com/**", (route) => route.abort());
  await page.route("https://restapi.amap.com/**", (route) => route.abort());

  const firstStop = page.locator("li").filter({ hasText: "1. 白川庵" });
  const secondStop = page.locator("li").filter({ hasText: "2. 三年坂" });
  await firstStop.getByRole("button", { name: "核对地点" }).click();
  await expect(page.getByRole("button", { name: /东山区清水/ })).toBeVisible();
  await page.screenshot({ path: `${directory}/candidates.png` });
  await page.getByRole("button", { name: /东山区清水/ }).click();
  await secondStop.getByRole("button", { name: "核对地点" }).click();
  await page.getByRole("button", { name: /东山区清水/ }).click();
  await expect(page.getByText("已核对").first()).toBeVisible();

  await page.getByRole("button", { name: "核实步行" }).first().click();
  await expect(page.getByText("步行 860 米 · 12 分钟")).toBeVisible();
  await page.screenshot({ path: `${directory}/verified.png` });
});
