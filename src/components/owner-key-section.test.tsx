import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnerKeySection } from "@/components/owner-key-section";
import { clearOwnerKey } from "@/lib/owner-key";

afterEach(() => {
  clearOwnerKey();
  vi.unstubAllGlobals();
});

describe("私人密钥设置", () => {
  it("保存并验证，失败和清除都会更新状态", async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    render(
      <QueryClientProvider client={client}>
        <OwnerKeySection />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("未设置");
    expect(screen.getByLabelText("私人密钥")).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "显示" }));
    expect(screen.getByLabelText("私人密钥")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "隐藏" }));

    await user.type(screen.getByLabelText("私人密钥"), "device-key");
    let resolveCheck: (response: Response) => void = () => undefined;
    fetchImpl.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveCheck = resolve;
        }),
    );
    await user.click(screen.getByRole("button", { name: "保存并验证" }));
    expect(screen.getByRole("status")).toHaveTextContent("验证中");
    resolveCheck(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(await screen.findByText("已通过")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["ai-usage-remote"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["api-status"] });

    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );
    await user.click(screen.getByRole("button", { name: "保存并验证" }));
    expect(await screen.findByText("密钥无效")).toBeInTheDocument();

    fetchImpl.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await user.click(screen.getByRole("button", { name: "保存并验证" }));
    expect(await screen.findByText("尝试过多")).toBeInTheDocument();

    fetchImpl.mockRejectedValueOnce(new Error("offline"));
    await user.click(screen.getByRole("button", { name: "保存并验证" }));
    expect(await screen.findByText("网络错误")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "清除" }));
    expect(screen.getByRole("status")).toHaveTextContent("未设置");
    expect(screen.getByLabelText("私人密钥")).toHaveValue("");
  });
});
