import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  applyTheme,
  blockPaidUpstream,
  expectTheme,
  mockStatus,
} from "./stage12-helpers";

const pages = [
  { path: "/", ready: "行程" },
  { path: "/explore", ready: "今天" },
  { path: "/profile", ready: "我的" },
  { path: "/trips/trip-kyoto", ready: "京都秋日" },
  { path: "/trips/trip-kyoto/budget", ready: "预算" },
  { path: "/trips/trip-kyoto/bookings", ready: "预订" },
  { path: "/trips/trip-kyoto/kit", ready: "清单" },
  { path: "/trips/trip-kyoto/guide", ready: "攻略" },
];

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    )
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target),
    }));
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`纸夜 ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await blockPaidUpstream(page);
      await mockStatus(page);
      await applyTheme(page, theme);
    });

    for (const entry of pages) {
      test(`${entry.path} 没有严重无障碍问题`, async ({ page }) => {
        await page.goto(entry.path);
        await expectTheme(page, theme);
        await expect(
          page.getByRole("heading", { name: entry.ready }).first(),
        ).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);
      });
    }

    test("助手抽屉与锁定按钮有名称", async ({ page }) => {
      await page.goto("/trips/trip-kyoto");
      await expectTheme(page, theme);
      await page.getByTestId("timeline-name").filter({ hasText: "白川庵" }).first().click();
      const lock = page.getByRole("button", { name: "解锁白川庵" }).first();
      await expect(lock).toBeVisible();
      const box = await lock.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await page.getByRole("button", { name: "助手" }).click();
      await expect(page.getByRole("heading", { name: "助手" })).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  });
}

test("减少动态效果时不做位移动画", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await blockPaidUpstream(page);
  await page.goto("/");
  await page.getByRole("link", { name: /京都秋日/ }).click();
  await expect(page.getByRole("heading", { name: /京都秋日/ })).toBeVisible();
  const transform = await page
    .locator("[data-app-scroll] > div")
    .first()
    .evaluate((element) => {
      return getComputedStyle(element).transform;
    });
  expect(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)").toBeTruthy();
});
