import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const directory = "docs/stage07/screenshots";

const draft = {
  title: "京都两日",
  destination: "京都",
  startDate: "2026-11-10",
  endDate: "2026-11-11",
  summary: "寺与巷",
  warnings: ["步行较多"],
  days: [
    {
      date: "2026-11-10",
      title: "东山",
      note: "",
      items: [
        {
          kind: "place",
          name: "清水寺",
          area: "东山",
          note: "",
          timeLabel: "09:30",
          checkIn: "",
          checkOut: "",
        },
      ],
    },
    {
      date: "2026-11-11",
      title: "离店",
      note: "",
      items: [
        {
          kind: "lodging",
          name: "町家",
          area: "祗园",
          note: "",
          timeLabel: "",
          checkIn: "2026-11-10",
          checkOut: "2026-11-11",
        },
      ],
    },
  ],
};

const usage = {
  model: "deepseek-flash",
  promptTokens: 10,
  completionTokens: 20,
  totalTokens: 30,
  cacheHitTokens: 0,
  cacheMissTokens: 10,
  latencyMs: 12,
  attempts: 1,
};

test.beforeAll(() => {
  mkdirSync(directory, { recursive: true });
});

test("生成草稿、预览、保存，并截下各种状态", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("lvxu-owner-key", "device-key");
  });

  let mode = "success";
  let release = () => undefined;
  await page.route("**/api/ai/usage", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        caps: { dailyRequests: 30, dailyTokens: 100000 },
        today: { requests: 1, tokens: 30 },
        month: { requests: 1, tokens: 30 },
      }),
    });
  });
  await page.route("**/api/ai/itinerary", async (route) => {
    expect(route.request().headers().authorization).toBe("Bearer device-key");
    if (mode === "delay" || mode === "retry-delay") {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    if (mode === "rate") {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "rate_limited", message: "请求过于频繁。" }),
      });
      return;
    }
    if (mode === "quota") {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "quota_exceeded", message: "今日额度已用完。" }),
      });
      return;
    }
    if (mode === "unauthorized") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      });
      return;
    }
    if (mode === "abort") {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ draft, usage }),
    });
  });

  await page.goto("/");
  await page.getByRole("link", { name: "用 AI 起草" }).click();
  await expect(page.getByRole("button", { name: "生成草稿" })).toBeVisible();
  await page.screenshot({ path: `${directory}/empty.png` });

  await page.getByLabel("目的地").fill("京都");
  await page.getByLabel("开始日期").fill("2026-11-12");
  await page.getByLabel("结束日期").fill("2026-11-10");
  await page.getByRole("button", { name: "生成草稿" }).click();
  await expect(page.getByText("结束日期不能早于开始日期")).toBeVisible();
  await page.screenshot({ path: `${directory}/validation-error.png` });

  await page.getByLabel("开始日期").fill("2026-11-10");
  await page.getByLabel("结束日期").fill("2026-11-11");
  mode = "delay";
  const generating = page.getByRole("button", { name: "生成草稿" }).click();
  await expect(page.getByText("正在生成")).toBeVisible();
  await page.screenshot({ path: `${directory}/generating.png` });
  mode = "success";
  release();
  await generating;
  await expect(page.getByText("清水寺")).toBeVisible();
  await page.screenshot({ path: `${directory}/preview.png` });

  await page.getByLabel("标题").fill("京都秋日草稿");
  await page.getByRole("button", { name: "保存为行程" }).click();
  await expect(page.getByRole("heading", { name: "京都秋日草稿" })).toBeVisible();
  await expect(page.getByText("清水寺")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "京都秋日草稿" })).toBeVisible();
  await expect(page.getByText("清水寺")).toBeVisible();
  await expect(page.getByText("町家")).toBeVisible();

  await page.goto("/plan");
  await page.getByLabel("目的地").fill("京都");
  await page.getByLabel("开始日期").fill("2026-11-10");
  await page.getByLabel("结束日期").fill("2026-11-11");

  mode = "rate";
  await page.getByRole("button", { name: "生成草稿" }).click();
  await expect(page.getByText("请求过于频繁。")).toBeVisible();
  await page.screenshot({ path: `${directory}/rate-limited.png` });

  mode = "quota";
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByText("今日额度已用完。")).toBeVisible();
  await page.screenshot({ path: `${directory}/quota-exceeded.png` });

  mode = "abort";
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByText("没有连上模型服务")).toBeVisible();
  await page.screenshot({ path: `${directory}/network-error.png` });

  mode = "unauthorized";
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByText("请先在「我的」里保存并通过私人密钥")).toBeVisible();
  await page.screenshot({ path: `${directory}/unauthorized.png` });

  mode = "retry-delay";
  const retry = page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByText("正在重试")).toBeVisible();
  await page.screenshot({ path: `${directory}/retrying.png` });
  mode = "success";
  release();
  await retry;
  await expect(page.getByText("清水寺")).toBeVisible();
});
