import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const shots = "docs/ux-pass/screenshots";

test.beforeAll(() => {
  mkdirSync(shots, { recursive: true });
});

test("首页、今天和收起的地图先给行程本身", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "即将出发" }).or(page.getByRole("heading", { name: "进行中" })).or(page.getByRole("heading", { name: "已结束" })).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "更多京都秋日" })).toBeVisible();
  await expect(page.getByRole("button", { name: "删除京都秋日" })).toHaveCount(0);
  await page.screenshot({ path: `${shots}/home-390.png` });

  await page.getByRole("link", { name: "今天" }).click();
  await expect(page.getByRole("heading", { name: "今天" })).toBeVisible();
  await expect(page.getByText("地图以后再接")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "下一站" })).toBeVisible();
  await page.screenshot({ path: `${shots}/today-390.png` });

  await page.goto("/trips/trip-kyoto");
  await expect(page.getByTestId("map-summary")).toBeVisible();
  await expect(page.getByRole("button", { name: "核实步行" })).toHaveCount(0);
  const summaryBox = await page.getByTestId("map-summary").boundingBox();
  const timeline = page.getByTestId("timeline-name").first();
  const timelineBox = await timeline.boundingBox();
  expect(summaryBox && timelineBox ? timelineBox.y - summaryBox.y : 1).toBeLessThan(700);

  await page.getByRole("button", { name: "展开地图" }).click();
  const firstPlace = page.getByRole("button", { name: /1\. 白川庵/ }).first();
  await expect(firstPlace).toBeVisible();
  await expect(page.getByRole("button", { name: "核实步行" })).toHaveCount(0);
  await firstPlace.click();
  await expect(page.getByRole("button", { name: "核实步行" })).toBeVisible();
  await page.screenshot({ path: `${shots}/trip-detail-map-390.png` });
});

test("预算的实际花费没有超支时不用强调色", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trips/trip-kyoto/budget");
  await expect(page.locator("[data-over='false']").first()).toBeVisible();
  await expect(page.locator("[data-over='true']")).toHaveCount(0);
  await page.screenshot({ path: `${shots}/budget-390.png` });
});

test("找不到的页面有回去的路", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.screenshot({ path: `${shots}/home-375.png` });
  await page.goto("/missing-page");
  await expect(page.getByText("这个地址没有页面")).toBeVisible();
  await page.getByRole("link", { name: "回到行程" }).click();
  await expect(page.getByRole("heading", { name: "行程" })).toBeVisible();
});
