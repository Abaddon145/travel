import { expect, test } from "@playwright/test";

test("私人密钥设置的几种状态", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route("**/api/status", async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        service: "lvxu",
        authMode: "owner-key",
        configured: false,
        auth: "unconfigured",
        paidApi: "locked",
      }),
    });
  });

  await page.goto("/profile");
  await expect(page.getByRole("status").filter({ hasText: "未设置" })).toBeVisible();
  await expect(page.getByText("尚未配置私人密钥")).toBeVisible();
  await expect(page.getByLabel("私人密钥")).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "显示" }).click();
  await expect(page.getByLabel("私人密钥")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "隐藏" }).click();

  await page.getByLabel("私人密钥").fill("device-key");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "已保存在这台设备" }),
  ).toBeVisible();

  await page.route("**/api/auth/check", async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer device-key");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.getByRole("button", { name: "验证", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "验证中" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "已通过" })).toBeVisible();

  await page.route("**/api/auth/check", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ auth: "unauthorized", error: "unauthorized" }),
    });
  });
  await page.getByRole("button", { name: "验证", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "密钥无效" })).toBeVisible();

  await page.route("**/api/auth/check", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ auth: "rate_limited", error: "rate_limited" }),
    });
  });
  await page.getByRole("button", { name: "验证", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "尝试过多" })).toBeVisible();

  await page.route("**/api/auth/check", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "验证", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "网络错误" })).toBeVisible();

  await page.getByRole("button", { name: "清除", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "未设置" })).toBeVisible();
  await expect(page.getByLabel("私人密钥")).toHaveValue("");
});
