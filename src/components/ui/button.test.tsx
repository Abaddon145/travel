import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("渲染标签并可点击", async () => {
    const user = userEvent.setup();
    let clicks = 0;
    render(<Button onClick={() => clicks++}>保存</Button>);
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(clicks).toBe(1);
  });
});
