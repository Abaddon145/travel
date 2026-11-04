import { describe, expect, it, vi } from "vitest";
import { readApiStatus } from "@/lib/api-status";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("接口状态", () => {
  it("区分已连接、未配置、未授权、限流和错误", async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce(jsonResponse(200, { auth: "connected" }));
    await expect(readApiStatus(fetchImpl)).resolves.toEqual({ kind: "connected" });

    fetchImpl.mockResolvedValueOnce(jsonResponse(200, { auth: "unconfigured" }));
    await expect(readApiStatus(fetchImpl)).resolves.toEqual({ kind: "unconfigured" });

    fetchImpl.mockResolvedValueOnce(jsonResponse(401, { auth: "unauthorized" }));
    await expect(readApiStatus(fetchImpl)).resolves.toEqual({ kind: "unauthorized" });

    fetchImpl.mockResolvedValueOnce(jsonResponse(429, { auth: "rate_limited" }));
    await expect(readApiStatus(fetchImpl)).resolves.toEqual({ kind: "rate_limited" });

    fetchImpl.mockRejectedValueOnce(new Error("offline"));
    await expect(readApiStatus(fetchImpl)).resolves.toEqual({ kind: "error" });
  });
});
