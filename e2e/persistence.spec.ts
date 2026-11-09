import { expect, test } from "@playwright/test";

test("创建的行程在刷新后仍在，锁定、排序和恢复版本可用", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建行程" }).click();
  await page.getByLabel("标题").fill("京都测试");
  await page.getByLabel("目的地").fill("京都");
  await page.getByLabel("开始日期").fill("2026-12-01");
  await page.getByLabel("结束日期").fill("2026-12-03");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("先写下目的地和日期")).toBeHidden();
  await page.getByRole("link", { name: /京都测试/ }).click();
  await expect(page.getByRole("heading", { name: "京都测试" })).toBeVisible();

  await page.getByRole("button", { name: "添加一天" }).click();
  await page.getByLabel("日期").fill("2026-12-01");
  await page.getByLabel("标题").fill("第一天");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("日期在同一趟行程里不能重复。")).toBeHidden();

  await page.getByRole("button", { name: "在第一天添加项目" }).click();
  await page.getByLabel("名称").fill("清水寺");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("名称会显示在当天的时间线上。")).toBeHidden();

  await page.getByRole("button", { name: "在第一天添加项目" }).click();
  await page.getByRole("radio", { name: "住宿" }).click();
  await page.getByLabel("名称").fill("白川庵");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByTestId("timeline-name").filter({ hasText: "白川庵" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "京都测试" })).toBeVisible();
  await expect(page.getByTestId("timeline-name").filter({ hasText: "清水寺" })).toBeVisible();
  await expect(page.getByTestId("timeline-name").filter({ hasText: "白川庵" })).toBeVisible();

  await page.getByRole("button", { name: "在第一天添加项目" }).click();
  await page.getByLabel("名称").fill("二年坂");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByTestId("timeline-name")).toHaveText([
    "清水寺",
    "白川庵",
    "二年坂",
  ]);
  await page.getByRole("button", { name: "上移二年坂" }).click();
  await page.getByRole("button", { name: "上移二年坂" }).click();
  await expect(page.getByTestId("timeline-name")).toHaveText([
    "二年坂",
    "清水寺",
    "白川庵",
  ]);

  await page.reload();
  await expect(page.getByTestId("timeline-name")).toHaveText([
    "二年坂",
    "清水寺",
    "白川庵",
  ]);

  await page.getByRole("button", { name: "锁定清水寺" }).click();
  await expect(page.getByRole("button", { name: "编辑清水寺" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "上移清水寺" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "下移清水寺" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "删除清水寺" })).toBeDisabled();

  await page.getByRole("button", { name: "编辑行程" }).click();
  await page.getByLabel("标题").fill("京都测试改");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("heading", { name: "京都测试改" })).toBeVisible();

  await page.getByRole("button", { name: "版本记录" }).click();
  await page.getByRole("button", { name: "恢复修改行程之前" }).click();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(page.getByText("已恢复到该版本")).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).click();
  await expect(page.getByRole("heading", { name: "京都测试" })).toBeVisible();
});
