import { expect, test } from "@playwright/test";
import { blockPaidUpstream } from "./stage12-helpers";

test.beforeEach(async ({ page }) => {
  await blockPaidUpstream(page);
});

test("长页面跟着文档滚动，底部标签保持固定", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "我的" })).toBeVisible();
  const shell = page.locator("[data-app-shell]");
  const height = await shell.evaluate((element) => ({
    shell: element.getBoundingClientRect().height,
    viewport: window.innerHeight,
  }));
  expect(height.shell).toBeGreaterThanOrEqual(height.viewport - 1);

  const tab = page.getByRole("navigation", { name: "主导航" });
  const before = await tab.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const after = await tab.boundingBox();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1);
  expect((after?.y ?? 0) + (after?.height ?? 0)).toBeLessThanOrEqual(height.viewport + 1);
});

test("安全区、16px 输入和独立窗口样式都在", async ({ page }) => {
  await page.goto("/");
  const css = await page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules].map((rule) => rule.cssText);
        } catch {
          return [];
        }
      })
      .join("\n"),
  );
  expect(css).toContain("safe-area-inset-top");
  expect(css).toContain("safe-area-inset-bottom");
  expect(css).toMatch(/display-mode:\s*standalone/);
  await expect(page.locator("header").first()).toHaveClass(/pt-safe/);
  await expect(page.getByRole("navigation", { name: "主导航" })).toHaveClass(/pb-safe/);

  await page.getByRole("button", { name: "新建行程" }).click();
  const titleSize = await page.getByLabel("标题").evaluate((element) => {
    return Number.parseFloat(getComputedStyle(element).fontSize);
  });
  expect(titleSize).toBeGreaterThanOrEqual(16);

  await page.goto("/trips/trip-kyoto");
  await page.getByRole("button", { name: "编辑抵达白川" }).click();
  const timeSize = await page.getByLabel("抵达白川锁定开始").evaluate((element) => {
    return Number.parseFloat(getComputedStyle(element).fontSize);
  });
  expect(timeSize).toBeGreaterThanOrEqual(16);
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.locator("[data-slot=drawer-overlay]")).toBeHidden();
  await page.getByRole("button", { name: "助手" }).click();
  const noteSize = await page.getByLabel("调整说明").evaluate((element) => {
    return Number.parseFloat(getComputedStyle(element).fontSize);
  });
  expect(noteSize).toBeGreaterThanOrEqual(16);
});

test("主屏幕样式分支关闭文档回弹", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query.includes("display-mode")) {
        return {
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return false;
          },
        } as MediaQueryList;
      }
      return original(query);
    };
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "行程" })).toBeVisible();
  await expect
    .poll(() => page.locator("html").getAttribute("data-display"))
    .toBe("standalone");
  const metrics = await page.locator("[data-app-shell]").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      overscroll: style.overscrollBehavior,
      height: style.height,
      viewport: window.innerHeight,
    };
  });
  expect(metrics.overscroll).toBe("none");
  expect(Number.parseFloat(metrics.height)).toBeGreaterThanOrEqual(metrics.viewport - 1);
});
