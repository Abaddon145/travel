import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseStatus } from "@/components/database-status";
import { resetDatabase, db } from "@/db/database";
import { deleteTrip, readTripSummaries } from "@/db/repository";
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

describe("行程页面", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("空列表有明确的空状态", async () => {
    await renderRoute("/");
    expect(await screen.findByRole("link", { name: /京都秋日/ })).toBeInTheDocument();
    const trips = await readTripSummaries(db);
    for (const trip of trips) {
      await deleteTrip(db, trip.id);
    }
    expect(await screen.findByText("还没有行程")).toBeInTheDocument();
  });

  it("锁定后不能编辑、移动或删除", async () => {
    const user = userEvent.setup();
    await renderRoute("/trips/trip-kyoto");
    await user.click(await screen.findByRole("button", { name: "锁定清水寺" }));
    expect(await screen.findByRole("button", { name: "解锁清水寺" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑清水寺" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除清水寺" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "上移清水寺" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下移清水寺" })).toBeDisabled();
  });
});

describe("数据库状态", () => {
  it("错误状态可以重试，不可用时说明 IndexedDB", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const view = render(<DatabaseStatus kind="error" onRetry={onRetry} />);
    expect(screen.getByText("行程暂时读不出来")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledOnce();
    view.rerender(<DatabaseStatus kind="unavailable" onRetry={onRetry} />);
    expect(screen.getByText(/IndexedDB/)).toBeInTheDocument();
  });
});
