import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "@/db/database";
import { AppProviders } from "@/providers/app-providers";
import { appRoutes } from "@/router";

async function renderRoute(path: string) {
  const memoryRouter = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(
    <AppProviders>
      <MotionConfig reducedMotion="always">
        <RouterProvider router={memoryRouter} />
      </MotionConfig>
    </AppProviders>,
  );
}

describe("预算页", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("显示京都示例的预计、实际和分类", async () => {
    await renderRoute("/trips/trip-kyoto/budget");
    expect(await screen.findByText("¥4,565.00")).toBeInTheDocument();
    expect(screen.getByText("¥3,929.00")).toBeInTheDocument();
    expect(screen.getByText("少 ¥636.00 · 已记少 ¥556.00 · 未记 ¥80.00")).toBeInTheDocument();
    expect(screen.getAllByText("住宿").length).toBeGreaterThan(0);
    expect(screen.getByText("清水寺门票")).toBeInTheDocument();
  });

  it("没有账目时给出空状态，空表单会指出缺了什么", async () => {
    const user = userEvent.setup();
    await renderRoute("/trips/trip-hangzhou/budget");
    expect(await screen.findByText("还没有预算")).toBeInTheDocument();
    expect(screen.getByText("预计和实际分开记。不同币种不会混在一起。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "记一笔" }));
    await user.click(await screen.findByRole("button", { name: "保存" }));
    expect(await screen.findByText("请填写名称")).toBeInTheDocument();
    expect(screen.getByText("请填写预计或实际")).toBeInTheDocument();
  });
});
