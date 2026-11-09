import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "@/db/database";
import { AppProviders } from "@/providers/app-providers";
import { appRoutes } from "@/router";

describe("攻略页", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("把京都示例排成可打印的日程、预算和清单", async () => {
    const memoryRouter = createMemoryRouter(appRoutes, {
      initialEntries: ["/trips/trip-kyoto/guide"],
    });
    render(
      <AppProviders>
        <MotionConfig reducedMotion="always">
          <RouterProvider router={memoryRouter} />
        </MotionConfig>
      </AppProviders>,
    );
    expect(await screen.findByRole("button", { name: "打印或存储为 PDF" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "日程" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "预算" })).toBeInTheDocument();
    expect(screen.getByText(/¥4,565\.00/)).toBeInTheDocument();
    expect(screen.getAllByText(/清水寺/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "预订" })).toBeInTheDocument();
    expect(screen.getByText(/白川旅店/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "清单" })).toBeInTheDocument();
    expect(screen.getByText(/护照/)).toBeInTheDocument();
    expect(screen.getByText(/苹方/)).toBeInTheDocument();
  });

  it("找不到行程时给出空状态", async () => {
    const memoryRouter = createMemoryRouter(appRoutes, {
      initialEntries: ["/trips/missing/guide"],
    });
    render(
      <AppProviders>
        <MotionConfig reducedMotion="always">
          <RouterProvider router={memoryRouter} />
        </MotionConfig>
      </AppProviders>,
    );
    expect(await screen.findByText("这趟行程不存在")).toBeInTheDocument();
  });
});
