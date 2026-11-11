import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/providers/app-providers";
import { appRoutes } from "@/router";

function renderAt(path: string) {
  const memoryRouter = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(
    <AppProviders>
      <MotionConfig reducedMotion="always">
        <RouterProvider router={memoryRouter} />
      </MotionConfig>
    </AppProviders>,
  );
}

describe("应用外壳", () => {
  it("在底部标签间切换页面", async () => {
    const user = userEvent.setup();
    renderAt("/");

    expect(await screen.findByRole("heading", { name: "行程" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "今天" }));
    expect(await screen.findByRole("heading", { name: "今天" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "我的" }));
    expect(await screen.findByRole("heading", { name: "我的" })).toBeInTheDocument();
  });
});
