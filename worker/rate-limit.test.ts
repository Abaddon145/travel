// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { enforceRateLimit, rateLimitKey } from "./rate-limit";

describe("限流", () => {
  it("同一身份得到稳定的键，且不包含明文邮箱", async () => {
    const first = await rateLimitKey("Owner@example.com", "1.1.1.1");
    const second = await rateLimitKey("owner@example.com", "9.9.9.9");
    const byIp = await rateLimitKey(null, "1.1.1.1");
    expect(first).toBe(second);
    expect(first).not.toContain("example.com");
    expect(byIp).not.toBe(first);
  });

  it("绑定拒绝时返回 limited", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    await expect(enforceRateLimit({ limit }, "abc")).resolves.toBe("limited");
    await expect(
      enforceRateLimit({ limit: async () => ({ success: true }) }, "abc"),
    ).resolves.toBe("ok");
  });
});
