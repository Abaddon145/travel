import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { settleEnter } from "./settle-enter";

const directory = "docs/stage11/screenshots";

test.beforeAll(() => {
  mkdirSync(directory, { recursive: true });
});

async function shot(page: Page, name: string) {
  await settleEnter(page);
  await page.screenshot({ path: `${directory}/${name}.png` });
}

const legacyBackup = {
  schemaVersion: 1,
  trips: [
    {
      id: "old-osaka",
      name: "旧大阪",
      destination: "大阪",
      startDate: "2026-12-01",
      endDate: "2026-12-02",
      summary: "从旧备份迁过来",
      createdAt: 1,
      updatedAt: 2,
    },
  ],
  itinerary: [
    {
      id: "i2",
      tripId: "old-osaka",
      dayDate: "2026-12-01",
      dayTitle: "抵达",
      order: 0,
      kind: "place",
      name: "城公园",
      area: "中央",
      note: "",
      timeLabel: "10:00",
    },
  ],
};

test("安装元信息、备份、攻略和更新提示", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profile");
  await expect(page.getByTestId("install-meta")).toBeVisible();
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const manifest = await page.evaluate(async (href) => {
    const response = await fetch(href ?? "/manifest.webmanifest");
    return response.json();
  }, manifestHref);
  expect(manifest.display).toBe("standalone");
  expect(manifest.short_name).toBe("旅序");
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(
    true,
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  await expect(page.locator('link[rel="apple-touch-icon"][sizes="180x180"]')).toHaveAttribute(
    "href",
    "/apple-touch-icon.png",
  );
  expect(await page.locator('link[rel="apple-touch-startup-image"]').count()).toBeGreaterThan(0);
  await page.getByTestId("install-meta").scrollIntoViewIfNeeded();
  await shot(page, "iphone-install");

  await page.getByTestId("backup-section").scrollIntoViewIfNeeded();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;
  const file = JSON.parse(readFileSync(await download.path(), "utf8")) as {
    schemaVersion: number;
    tables: { ledgerEntries: unknown[]; bookings: unknown[] };
  };
  expect(file.schemaVersion).toBe(7);
  expect(file.tables.ledgerEntries.length).toBeGreaterThan(0);
  expect(file.tables.bookings.length).toBeGreaterThan(0);
  expect(JSON.stringify(file)).not.toContain("lvxu-owner-key");
  await expect(page.getByTestId("backup-success")).toBeVisible();
  await page.getByTestId("backup-success").scrollIntoViewIfNeeded();
  await shot(page, "iphone-backup-export");

  await page.getByLabel("选择备份文件").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacyBackup)),
  });
  await expect(page.getByRole("heading", { name: "导入预览" })).toBeVisible();
  await expect(page.getByText(/版本 1/)).toBeVisible();
  await page.getByTestId("backup-preview").scrollIntoViewIfNeeded();
  await shot(page, "iphone-import-preview");
  await page.getByRole("button", { name: "确认导入" }).click();
  await page.getByRole("button", { name: "确认合并" }).click();
  await expect(page.getByTestId("backup-success")).toContainText("已合并");
  await shot(page, "iphone-import-success");

  await page.goto("/trips/trip-kyoto/guide");
  await expect(page.getByRole("button", { name: "打印或存储为 PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "预算" })).toBeVisible();
  await expect(page.getByText("¥4,565.00")).toBeVisible();
  await shot(page, "iphone-guide");

  await page.goto("/?sw-update=1");
  await expect(page.getByTestId("update-prompt")).toBeVisible();
  await expect(page.getByRole("button", { name: "稍后" })).toBeVisible();
  await shot(page, "iphone-update");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/profile");
  await page.getByTestId("install-meta").scrollIntoViewIfNeeded();
  await shot(page, "desktop-install");
  await page.getByTestId("backup-section").scrollIntoViewIfNeeded();
  await shot(page, "desktop-backup-export");
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacyBackup)),
  });
  await expect(page.getByRole("heading", { name: "导入预览" })).toBeVisible();
  await page.getByTestId("backup-preview").scrollIntoViewIfNeeded();
  await shot(page, "desktop-import-preview");
  await page.getByRole("button", { name: "确认导入" }).click();
  await page.getByRole("button", { name: "确认合并" }).click();
  await expect(page.getByTestId("backup-success")).toContainText("已合并");
  await shot(page, "desktop-import-success");
  await page.goto("/trips/trip-kyoto/guide");
  await expect(page.getByText("¥4,565.00")).toBeVisible();
  await shot(page, "desktop-guide");
  await page.goto("/?sw-update=1");
  await expect(page.getByTestId("update-prompt")).toBeVisible();
  await shot(page, "desktop-update");
});

test("离线可打开已保存的行程，且不缓存鉴权响应", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /京都秋日/ })).toBeVisible();
  const worker = await page.request.get("/sw.js");
  expect(worker.ok()).toBeTruthy();
  const source = await worker.text();
  expect(source).toContain("NetworkOnly");
  expect(source).toContain("api");
  expect(source).toContain("_AMapService");
  expect(source).not.toContain("CacheFirst");

  await page.evaluate(async () => {
    await fetch("/api/status").catch(() => undefined);
    await fetch("/_AMapService/v3/geocode/geo").catch(() => undefined);
  });

  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await expect(page.getByRole("link", { name: /京都秋日/ })).toBeVisible();
  await shot(page, "iphone-offline");

  await page.getByRole("link", { name: /京都秋日/ }).click();
  await expect(page.getByRole("heading", { name: /京都秋日/ })).toBeVisible();
  await expect(page.getByText("清水寺").first()).toBeVisible();
  await page.getByRole("button", { name: "展开地图" }).click();
  await page.getByRole("button", { name: /清水寺/ }).first().click();
  await expect(page.getByRole("button", { name: "核对需要网络" }).first()).toBeVisible();
  await shot(page, "iphone-offline-trip");

  await page.getByRole("link", { name: "返回" }).click();
  await page.getByRole("link", { name: "用 AI 起草" }).click();
  await expect(page.getByText("生成行程需要网络。已保存在这台设备上的行程仍可查看。")).toBeVisible();
  await expect(page.getByRole("button", { name: "生成草稿" })).toBeDisabled();

  await page.getByRole("link", { name: "返回" }).click();
  await page.getByRole("link", { name: "我的" }).click();
  await expect(page.getByText("当前离线", { exact: true })).toBeVisible();
  await expect(
    page.getByText("验证私人密钥需要网络。密钥仍只写在这台设备上，不会因为离线被发出去。"),
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("link", { name: "行程", exact: true }).click();
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await expect(page.getByRole("link", { name: /京都秋日/ })).toBeVisible();
  await shot(page, "desktop-offline");
});
