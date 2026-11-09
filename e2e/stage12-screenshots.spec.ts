import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  applyTheme,
  blockPaidUpstream,
  expectTheme,
  mockStatus,
} from "./stage12-helpers";

const directory = "docs/stage12/screenshots";

test.beforeAll(() => {
  mkdirSync(directory, { recursive: true });
});

async function shot(page: Page, info: TestInfo, theme: string, name: string) {
  await page.screenshot({
    path: `${directory}/${info.project.name}-${theme}-${name}.png`,
  });
}

for (const theme of [
  { id: "light" as const, file: "paper" },
  { id: "dark" as const, file: "night" },
]) {
  test(`核心页面截图 ${theme.file}`, async ({ page }, info) => {
    await blockPaidUpstream(page);
    await mockStatus(page);
    await applyTheme(page, theme.id);

    await page.goto("/");
    await expectTheme(page, theme.id);
    await expect(page.getByRole("link", { name: /京都秋日/ })).toBeVisible();
    await shot(page, info, theme.file, "trips");

    await page.getByRole("link", { name: /京都秋日/ }).click();
    await expect(page.getByRole("heading", { name: "京都秋日" })).toBeVisible();
    await shot(page, info, theme.file, "detail");

    await page.getByRole("link", { name: "预算" }).click();
    await expect(page.locator("[data-final='¥4,565.00']")).toHaveText("¥4,565.00");
    await shot(page, info, theme.file, "budget");

    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "我的" })).toBeVisible();
    await shot(page, info, theme.file, "profile");

    await page.goto("/trips/trip-kyoto");
    await page.getByRole("button", { name: "助手" }).click();
    await expect(page.getByRole("heading", { name: "助手" })).toBeVisible();
    await shot(page, info, theme.file, "assistant");
  });
}
