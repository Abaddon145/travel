import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiStatusCard } from "@/components/api-status-card";
import { clearOwnerKey, saveOwnerKey } from "@/lib/owner-key";

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">
        <ApiStatusCard />
      </MotionConfig>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  clearOwnerKey();
  vi.unstubAllGlobals();
});

describe("云端接口状态", () => {
  it("加载结束后显示未授权", async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    renderCard();
    expect(screen.getByText("正在读取接口状态")).toBeInTheDocument();
    resolveFetch(new Response(JSON.stringify({ auth: "unauthorized" }), { status: 401 }));
    expect(await screen.findByText("未授权")).toBeInTheDocument();
  });

  it("限流时可以重试", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ auth: "rate_limited" }), { status: 429 }),
      ),
    );
    renderCard();
    expect(await screen.findByText("请求过于频繁")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();
  });

  it("私人密钥通过后显示已验证", async () => {
    saveOwnerKey("device-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/auth/check")) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            auth: "unauthorized",
            authMode: "owner-key",
            configured: true,
          }),
          { status: 200 },
        );
      }),
    );
    renderCard();
    expect(await screen.findByText("已通过")).toBeInTheDocument();
    expect(screen.getByText("私人密钥已验证。可以在行程页生成多日草稿。")).toBeInTheDocument();
  });
});
