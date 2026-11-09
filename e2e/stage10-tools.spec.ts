import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const directory = "docs/stage10/screenshots";

test.beforeAll(() => {
  mkdirSync(directory, { recursive: true });
});

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
}

test("记录预算、预订和清单", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trips/trip-kyoto/budget");
  await expect(page.locator("[data-final='¥4,565.00']")).toHaveText("¥4,565.00");
  await expect(page.getByText("少 ¥636.00 · 已记少 ¥556.00 · 未记 ¥80.00")).toBeVisible();
  await expect(page.getByRole("region", { name: "分类统计" })).toBeVisible();
  await shot(page, "iphone-budget");

  await page.getByRole("heading", { name: "明细" }).evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
  await expect(page.getByText("清水寺门票")).toBeVisible();
  await page.screenshot({ path: `${directory}/iphone-entries.png` });

  await page.getByRole("link", { name: "预订" }).click();
  await expect(page.getByText("白川旅店")).toBeVisible();
  await expect(page.getByText("のぞみ 231")).toBeVisible();
  await expect(page.getByText("三年坂晚饭")).toBeVisible();
  await shot(page, "iphone-bookings");

  await page.getByRole("link", { name: "清单" }).click();
  await expect(page.getByText("护照")).toBeVisible();
  await expect(page.getByText("锦市场")).toBeVisible();
  await shot(page, "iphone-kit");
  await page.getByText("稻荷怎么走").scrollIntoViewIfNeeded();
  await expect(page.getByText("稻荷怎么走")).toBeVisible();
  await page.screenshot({ path: `${directory}/iphone-notes.png` });

  await page.goto("/trips/trip-hangzhou/budget");
  await expect(page.getByText("还没有预算")).toBeVisible();
  await shot(page, "iphone-empty");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/trips/trip-kyoto/budget");
  await expect(page.locator("[data-final='¥4,565.00']")).toHaveText("¥4,565.00");
  await shot(page, "desktop-budget");

  await page.getByRole("link", { name: "预订" }).click();
  await expect(page.getByText("白川旅店")).toBeVisible();
  await shot(page, "desktop-bookings");

  await page.goto("/trips/trip-hangzhou/kit");
  await expect(page.getByText("还没有清单")).toBeVisible();
  await shot(page, "desktop-empty");
});
