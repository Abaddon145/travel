// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class DurableObject {},
}));

import worker from "./index";
import { sha256Bytes } from "./owner-key";

async function ownerHash(key: string) {
  const bytes = await sha256Bytes(key);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("Worker 入口", () => {
  it("接口响应带安全头，静态资源仍交给 Assets", async () => {
    const hash = await ownerHash("right-key");
    const assets = vi.fn(async () => new Response("<html></html>", { status: 200 }));
    const env = {
      ENVIRONMENT: "production",
      AUTH_MODE: "owner-key",
      OWNER_KEY_SHA256: hash,
      ACCESS_DEV_BYPASS: "",
      AMAP_JS_SECURITY_CODE: "server-only-code",
      API_RATE_LIMIT: { limit: async () => ({ success: true }) },
      AUTH_FAILURE_LIMIT: { limit: async () => ({ success: true }) },
      ASSETS: { fetch: assets },
    };

    const denied = await worker.fetch(
      new Request("https://lvxu.test/api/ai/itinerary", { method: "POST" }),
      env as never,
    );
    expect(denied.status).toBe(401);
    expect(denied.headers.get("cache-control")).toContain("no-store");
    expect(denied.headers.get("x-content-type-options")).toBe("nosniff");
    expect(denied.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );

    const proxy = await worker.fetch(
      new Request("https://lvxu.test/_AMapService/v5/place/text"),
      env as never,
    );
    expect(proxy.status).toBe(401);
    expect(proxy.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(proxy.headers.get("cache-control")).toContain("no-store");

    const page = await worker.fetch(new Request("https://lvxu.test/"), env as never);
    expect(page.status).toBe(200);
    expect(assets).toHaveBeenCalledOnce();
    expect(page.headers.get("content-security-policy")).toBeNull();
  });
});
