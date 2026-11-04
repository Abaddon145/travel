import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const directory = "docs/stage09/screenshots";

test.beforeAll(() => {
  mkdirSync(directory, { recursive: true });
});

async function sheetOpen(page: Page) {
  await expect.poll(async () => {
    const box = await page.locator("[data-slot=drawer-content]").boundingBox();
    return box?.height ?? 0;
  }).toBeGreaterThan(320);
}

test("锁定项目不会被助手改掉，其余修改可以撤销", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("lvxu-owner-key", "device-key");
  });
  await page.route("**/api/ai/revise", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "只改未锁定的三年坂。",
        ops: [{ op: "update", itemId: "item-2", note: "雨天改去室内" }],
        rejected: [{ op: "remove", itemId: "item-1" }],
        usage: {
          model: "deepseek-flash",
          promptTokens: 10,
          completionTokens: 8,
          totalTokens: 18,
          cacheHitTokens: 0,
          cacheMissTokens: 10,
          latencyMs: 20,
          attempts: 1,
        },
      }),
    });
  });
  await page.route("https://api.deepseek.com/**", (route) => route.abort());

  await page.goto("/trips/trip-kyoto");
  await expect(page.getByText("已锁定").first()).toBeVisible();
  await page.getByRole("button", { name: "助手" }).click();
  await sheetOpen(page);
  await expect(page.getByText("还没有对话")).toBeVisible();
  await page.locator("[data-slot=drawer-content]").screenshot({ path: `${directory}/empty.png` });

  await page.getByRole("button", { name: "雨天备选" }).click();
  await expect(page.getByText("已忽略碰到锁定内容的修改。")).toBeVisible();
  await expect(page.getByText("修改 三年坂：雨天改去室内")).toBeVisible();
  await expect(page.getByText("删除 白川庵")).toHaveCount(0);
  await sheetOpen(page);
  await page.locator("[data-slot=drawer-content]").screenshot({ path: `${directory}/diff.png` });

  await page.getByRole("button", { name: "应用所选" }).click();
  await expect(page.getByText("已写入行程。")).toBeVisible();
  await expect(page.getByText("雨天改去室内")).toBeVisible();
  await expect(page.getByText("白川庵").first()).toBeVisible();
  await sheetOpen(page);
  await page.locator("[data-slot=drawer-content]").screenshot({ path: `${directory}/applied.png` });

  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.getByText("已撤销这次调整。")).toBeVisible();
  await expect(page.getByText("晚饭前散步，不安排停留太久。")).toBeVisible();
  await expect(page.getByText("雨天改去室内")).toHaveCount(0);
  await sheetOpen(page);
  await page.locator("[data-slot=drawer-content]").screenshot({ path: `${directory}/undone.png` });
});
