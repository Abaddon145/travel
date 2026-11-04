import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/providers/app-providers";
import { appRoutes } from "@/router";
import { TripsPage } from "@/pages/trips-page";

describe("行程页面", () => {
  it("空列表有明确的空状态", () => {
    render(<TripsPage trips={[]} />);
    expect(screen.getByText("还没有行程")).toBeInTheDocument();
  });

  it("从列表进入时间线", async () => {
    const user = userEvent.setup();
    const memoryRouter = createMemoryRouter(appRoutes, { initialEntries: ["/"] });
    render(
      <AppProviders>
        <MotionConfig reducedMotion="always">
          <RouterProvider router={memoryRouter} />
        </MotionConfig>
      </AppProviders>,
    );

    await user.click(screen.getByRole("link", { name: /京都秋日/ }));
    expect(await screen.findByRole("heading", { name: "京都秋日" })).toBeInTheDocument();
    expect(screen.getByText("清水寺")).toBeInTheDocument();
    expect(screen.getAllByText("已锁定").length).toBeGreaterThan(0);
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
  });
});
