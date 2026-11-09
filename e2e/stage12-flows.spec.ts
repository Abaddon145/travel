import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { blockPaidUpstream } from "./stage12-helpers";

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
  completionTokens: 8,
  totalTokens: 18,
  cacheHitTokens: 0,
  cacheMissTokens: 10,
  latencyMs: 20,
  attempts: 1,
};

test.beforeEach(async ({ page }) => {
  await blockPaidUpstream(page);
});

test("新建、编辑并锁定行程后刷新仍在", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建行程" }).click();
  await page.getByLabel("标题").fill("奈良一日");
  await page.getByLabel("目的地").fill("奈良");
  await page.getByLabel("开始日期").fill("2026-12-01");
  await page.getByLabel("结束日期").fill("2026-12-01");
  await page.getByRole("button", { name: "保存" }).click();
  await page.getByRole("link", { name: /奈良一日/ }).click();
  await expect(page.getByRole("heading", { name: "奈良一日" })).toBeVisible();

  await page.getByRole("button", { name: "编辑行程" }).click();
  await page.getByLabel("标题").fill("奈良改期");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("heading", { name: "奈良改期" })).toBeVisible();

  await page.getByRole("button", { name: "添加一天" }).click();
  await page.getByLabel("日期").fill("2026-12-01");
  await page.getByLabel("标题").fill("公园");
  await page.getByRole("button", { name: "保存" }).click();
  await page.getByRole("button", { name: "在公园添加项目" }).click();
  await page.getByLabel("名称").fill("东大寺");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(
    page.getByTestId("timeline-name").filter({ hasText: "东大寺" }),
  ).toBeVisible();

  const lock = page.getByRole("button", { name: "锁定东大寺" });
  const box = await lock.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await lock.click();
  await expect(page.getByRole("button", { name: "编辑东大寺" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "删除东大寺" })).toBeDisabled();

  await page.reload();
  await expect(page.getByRole("heading", { name: "奈良改期" })).toBeVisible();
  await expect(
    page.getByTestId("timeline-name").filter({ hasText: "东大寺" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑东大寺" })).toBeDisabled();
});

test.describe("模拟付费接口", () => {
  test.use({ serviceWorkers: "block" });

  test("AI 起草只走模拟接口，确认后才写入", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("lvxu-owner-key", "device-key");
    });
    await page.route("**/api/ai/usage", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          configured: true,
          caps: { dailyRequests: 30, dailyTokens: 100000 },
          today: { requests: 0, tokens: 0 },
          month: { requests: 0, tokens: 0 },
        }),
      });
    });
    await page.route("**/api/ai/itinerary", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ draft, usage }),
      });
    });

    await page.goto("/plan");
    await page.getByLabel("目的地").fill("京都");
    await page.getByLabel("开始日期").fill("2026-11-10");
    await page.getByLabel("结束日期").fill("2026-11-11");
    await page.getByRole("button", { name: "生成草稿" }).click();
    await expect(page.getByText("清水寺")).toBeVisible();
    await page.getByRole("button", { name: "保存为行程" }).click();
    await expect(page.getByRole("heading", { name: "京都两日" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "京都两日" })).toBeVisible();
  });

  test("助手忽略锁定项，其余修改可以撤销", async ({ page }) => {
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
          usage,
        }),
      });
    });

    await page.goto("/trips/trip-kyoto");
    await expect(page.getByRole("button", { name: "解锁白川庵" }).first()).toBeVisible();
    await page.getByRole("button", { name: "助手" }).click();
    await page.getByRole("button", { name: "雨天备选" }).click();
    await expect(page.getByText("已忽略碰到锁定内容的修改。")).toBeVisible();
    await expect(page.getByText("修改 三年坂：雨天改去室内")).toBeVisible();
    await expect(page.getByText("删除 白川庵")).toHaveCount(0);
    await page.getByRole("button", { name: "应用所选" }).click();
    await expect(page.getByText("已写入行程。")).toBeVisible();
    await expect(page.getByText("雨天改去室内")).toBeVisible();
    await page.getByRole("button", { name: "撤销" }).click();
    await expect(page.getByText("已撤销这次调整。")).toBeVisible();
    await expect(page.getByText("雨天改去室内")).toHaveCount(0);
  });

  test("地图检索不访问高德源站", async ({ page }) => {
    const fulfilled: string[] = [];
    page.on("response", (response) => {
      const host = new URL(response.url()).hostname;
      const upstream =
        host.endsWith("amap.com") ||
        host.endsWith("autonavi.com") ||
        host === "api.deepseek.com";
      if (upstream && response.ok()) fulfilled.push(host);
    });
    await page.addInitScript(() => {
      localStorage.setItem("lvxu-owner-key", "device-key");
    });
    await page.route("**/api/map/config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          key: "test-js-key",
          serviceHost: "/_AMapService",
          version: "2.0",
        }),
      });
    });
    await page.route("**/api/map/poi/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          pois: [
            {
              id: "B001",
              name: "清水寺",
              address: "东山区清水",
              lng: 135.785,
              lat: 34.995,
            },
          ],
        }),
      });
    });
    await page.route("**/api/map/route**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          fetchedAt: Date.now(),
          route: {
            mode: "walking",
            distanceMeters: 860,
            durationSeconds: 720,
            polyline: "135.785,34.995;135.786,34.996",
          },
        }),
      });
    });

    await page.goto("/trips/trip-kyoto");
    await expect(page.getByText("未核实").first()).toBeVisible();
    await page.getByRole("button", { name: "展开地图" }).click();
    await page
      .locator("li")
      .filter({ hasText: "1. 白川庵" })
      .getByRole("button", { name: "核对地点" })
      .click();
    await expect(page.getByRole("button", { name: /东山区清水/ })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(fulfilled).toEqual([]);
  });
});

test("预算合计按币种显示", async ({ page }) => {
  await page.goto("/trips/trip-kyoto/budget");
  await expect(page.getByText("人民币")).toBeVisible();
  await expect(page.locator("[data-final='¥4,565.00']")).toHaveText("¥4,565.00");
  await expect(page.getByText("少 ¥636.00 · 已记少 ¥556.00 · 未记 ¥80.00")).toBeVisible();
});

test("预订和清单刷新后仍在", async ({ page }) => {
  await page.goto("/trips/trip-kyoto/bookings");
  await page
    .getByRole("heading", { name: "住宿", exact: true })
    .locator("..")
    .getByRole("button", { name: "添加" })
    .click();
  await page.getByLabel("住宿名称").fill("测试旅店");
  await page.getByLabel("入住").fill("2026-11-12");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("测试旅店")).toBeVisible();
  await page.reload();
  await expect(page.getByText("测试旅店")).toBeVisible();

  await page.getByRole("link", { name: "清单" }).click();
  await page
    .getByRole("heading", { name: "清单", exact: true })
    .locator("..")
    .getByRole("button", { name: "添加" })
    .click();
  await page.getByRole("textbox", { name: "事项" }).fill("转换插头");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("转换插头")).toBeVisible();
  await page.reload();
  await expect(page.getByText("转换插头")).toBeVisible();
});

test("备份导出不含密钥，导入后能恢复", async ({ page }) => {
  await page.goto("/profile");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;
  const file = JSON.parse(readFileSync(await download.path(), "utf8")) as {
    schemaVersion: number;
    tables: { trips: unknown[] };
  };
  expect(file.schemaVersion).toBe(7);
  expect(file.tables.trips.length).toBeGreaterThan(0);
  expect(JSON.stringify(file)).not.toContain("lvxu-owner-key");

  await page.getByLabel("选择备份文件").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
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
      }),
    ),
  });
  await expect(page.getByRole("heading", { name: "导入预览" })).toBeVisible();
  await page.getByRole("button", { name: "确认导入" }).click();
  await page.getByRole("button", { name: "确认合并" }).click();
  await expect(page.getByTestId("backup-success")).toContainText("已合并");
  await page.goto("/");
  await page.getByRole("link", { name: /旧大阪/ }).click();
  await expect(
    page.getByTestId("timeline-name").filter({ hasText: "城公园" }),
  ).toBeVisible();
});

test("离线仍可查看行程，更新提示可以稍后", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /京都秋日/ })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await page.getByRole("link", { name: /京都秋日/ }).click();
  await expect(page.getByRole("heading", { name: /京都秋日/ })).toBeVisible();
  await expect(page.getByText("清水寺").first()).toBeVisible();
  await context.setOffline(false);

  await page.goto("/?sw-update=1");
  await expect(page.getByTestId("update-prompt")).toBeVisible();
  await page.getByRole("button", { name: "稍后" }).click();
  await expect(page.getByTestId("update-prompt")).toBeHidden();
});
