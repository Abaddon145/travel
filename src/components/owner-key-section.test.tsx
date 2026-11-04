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
  it("未设置、保存、验证、失败和清除", async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    render(<OwnerKeySection />);
    expect(screen.getByRole("status")).toHaveTextContent("未设置");
    expect(screen.getByLabelText("私人密钥")).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "显示" }));
    expect(screen.getByLabelText("私人密钥")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "隐藏" }));

    await user.type(screen.getByLabelText("私人密钥"), "device-key");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByRole("status")).toHaveTextContent("已保存在这台设备");

    let resolveCheck: (response: Response) => void = () => undefined;
    fetchImpl.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveCheck = resolve;
        }),
    );
    await user.click(screen.getByRole("button", { name: "验证" }));
    expect(screen.getByRole("status")).toHaveTextContent("验证中");
    resolveCheck(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(await screen.findByText("已通过")).toBeInTheDocument();

    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );
    await user.click(screen.getByRole("button", { name: "验证" }));
    expect(await screen.findByText("密钥无效")).toBeInTheDocument();

    fetchImpl.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await user.click(screen.getByRole("button", { name: "验证" }));
    expect(await screen.findByText("尝试过多")).toBeInTheDocument();

    fetchImpl.mockRejectedValueOnce(new Error("offline"));
    await user.click(screen.getByRole("button", { name: "验证" }));
    expect(await screen.findByText("网络错误")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "清除" }));
    expect(screen.getByRole("status")).toHaveTextContent("未设置");
    expect(screen.getByLabelText("私人密钥")).toHaveValue("");
  });
});
