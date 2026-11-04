import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const directory = "/opt/cursor/artifacts/screenshots";

test.beforeAll(() => {
  mkdirSync(directory, { recursive: true });
});

test("记录 iPhone 视口下的主要界面", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /京都秋日/ })).toBeVisible();
  await page.screenshot({ path: `${directory}/trip-list.png` });

  await page.getByRole("link", { name: /京都秋日/ }).click();
  await expect(page.getByText("清水寺", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${directory}/trip-detail.png` });

  await page.getByRole("button", { name: "编辑行程" }).click();
  await expect(page.getByLabel("标题")).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: `${directory}/edit-sheet.png` });
  await page.getByRole("button", { name: "取消" }).click();

  await page.getByText("清水寺", { exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "锁定清水寺" }).click();
  await expect(page.getByRole("button", { name: "解锁清水寺" })).toBeVisible();
  await page.screenshot({ path: `${directory}/locked-item.png` });

  await page.getByRole("button", { name: "版本记录" }).click();
  await expect(page.getByRole("button", { name: "关闭" })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText("示例行程")).toBeVisible();
  await page.screenshot({ path: `${directory}/version-history.png` });
  await page.getByRole("button", { name: "关闭" }).click();

  await page.goto("/");
  for (const title of ["京都秋日", "杭州周末"]) {
    await page.getByRole("button", { name: `删除${title}` }).click();
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeHidden();
  }
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await page.evaluate(() => {
    document.querySelectorAll("[data-sonner-toast]").forEach((node) => node.remove());
  });
  await expect(page.getByText("还没有行程")).toBeVisible();
  await page.screenshot({ path: `${directory}/empty-state.png` });
});

test("记录数据库不可用时的错误状态", async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        return undefined;
      },
    });
  });
  await page.goto("/");
  await expect(page.getByText("无法使用本地数据库")).toBeVisible();
  await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
  await page.screenshot({ path: `${directory}/error-state.png` });
  await context.close();
});
