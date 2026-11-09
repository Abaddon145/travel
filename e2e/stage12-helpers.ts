import { expect, type Page } from "@playwright/test";

export async function blockPaidUpstream(page: Page) {
  const abort = (route: { abort: () => Promise<void> }) => route.abort();
  await page.route(/https:\/\/api\.deepseek\.com\//, abort);
  await page.route(/https:\/\/([^/]+\.)?amap\.com\//, abort);
  await page.route(/https:\/\/([^/]+\.)?autonavi\.com\//, abort);
}

export async function mockStatus(page: Page) {
  await page.route("**/api/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        service: "lvxu",
        environment: "production",
        authMode: "owner-key",
        configured: true,
        auth: "unauthorized",
        paidApi: "locked",
      }),
    });
  });
}

export async function applyTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((value) => {
    localStorage.setItem(
      "lvxu-preferences",
      JSON.stringify({ state: { theme: value }, version: 0 }),
    );
  }, theme);
  await page.emulateMedia({ colorScheme: theme === "dark" ? "dark" : "light" });
}

export async function expectTheme(page: Page, theme: "light" | "dark") {
  if (theme === "dark") {
    await expect(page.locator("html")).toHaveClass(/dark/);
  } else {
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  }
}
