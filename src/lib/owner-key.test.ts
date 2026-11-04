import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkOwnerKey,
  clearOwnerKey,
  gatedHeaders,
  saveOwnerKey,
} from "@/lib/owner-key";

afterEach(() => {
  clearOwnerKey();
  vi.unstubAllGlobals();
});

describe("私人密钥只附在受保护请求上", () => {
  it("状态请求不带密钥，付费、管理和验证请求才带", () => {
    saveOwnerKey("device-key");
    expect(gatedHeaders("/api/status").has("authorization")).toBe(false);
    expect(gatedHeaders("/api/paid/draft").get("authorization")).toBe(
      "Bearer device-key",
    );
    expect(gatedHeaders("/api/admin/health").get("authorization")).toBe(
      "Bearer device-key",
    );
    expect(gatedHeaders("/api/auth/check").get("authorization")).toBe(
      "Bearer device-key",
    );
    clearOwnerKey();
    expect(gatedHeaders("/api/paid/draft").has("authorization")).toBe(false);
  });

  it("验证结果区分通过、无效、过多和网络错误", async () => {
    saveOwnerKey("device-key");
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await expect(checkOwnerKey(fetchImpl)).resolves.toBe("ok");
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/api/auth/check");
    const headers = fetchImpl.mock.calls[0]?.[1].headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer device-key");

    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );
    await expect(checkOwnerKey(fetchImpl)).resolves.toBe("invalid");

    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "unconfigured" }), { status: 401 }),
    );
    await expect(checkOwnerKey(fetchImpl)).resolves.toBe("unconfigured");

    fetchImpl.mockResolvedValueOnce(new Response("{}", { status: 429 }));
    await expect(checkOwnerKey(fetchImpl)).resolves.toBe("limited");

    fetchImpl.mockRejectedValueOnce(new Error("offline"));
    await expect(checkOwnerKey(fetchImpl)).resolves.toBe("error");
  });
});
