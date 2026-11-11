// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class DurableObject {},
}));

import { legacyShellOrigin, shellOrigin, workerOrigin } from "../shared/shell-origin";
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
    expect(page.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("只给原生壳加 CORS，网页版仍写 Strict cookie", async () => {
    const hash = await ownerHash("right-key");
    const limit = vi.fn(async () => ({ success: true }));
    const assets = vi.fn(async () => new Response("page", { status: 200 }));
    const env = {
      ENVIRONMENT: "production",
      AUTH_MODE: "owner-key",
      OWNER_KEY_SHA256: hash,
      ACCESS_DEV_BYPASS: "",
      AMAP_JS_SECURITY_CODE: "server-only-code",
      API_RATE_LIMIT: { limit },
      AUTH_FAILURE_LIMIT: { limit },
      ASSETS: { fetch: assets },
    };
    const shell = shellOrigin;

    const options = await worker.fetch(
      new Request("https://lvxu.test/api/ai/itinerary", {
        method: "OPTIONS",
        headers: {
          origin: shell,
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization,content-type",
        },
      }),
      env as never,
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-origin")).toBe(shell);
    expect(options.headers.get("access-control-allow-credentials")).toBe("true");
    expect(options.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(limit).not.toHaveBeenCalled();

    const foreign = await worker.fetch(
      new Request("https://lvxu.test/api/status", {
        headers: { origin: "https://evil.example" },
      }),
      env as never,
    );
    expect(foreign.status).toBe(200);
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();

    const web = await worker.fetch(
      new Request("https://lvxu.test/api/auth/check", {
        headers: { authorization: "Bearer right-key", origin: "https://lvxu.test" },
      }),
      env as never,
    );
    expect(web.status).toBe(200);
    expect(web.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(web.headers.get("set-cookie")).not.toContain("SameSite=None");
    expect(web.headers.get("access-control-allow-origin")).toBeNull();

    const shellCheck = await worker.fetch(
      new Request("https://lvxu.test/api/auth/check", {
        headers: { authorization: "Bearer right-key", origin: shell },
      }),
      env as never,
    );
    expect(shellCheck.status).toBe(200);
    expect(shellCheck.headers.get("set-cookie")).toBeNull();
    expect(shellCheck.headers.get("access-control-allow-origin")).toBe(shell);

    const proxy = await worker.fetch(
      new Request("https://lvxu.test/_AMapService/v5/place/text", {
        headers: { origin: shell },
      }),
      env as never,
    );
    expect(proxy.status).toBe(401);
    expect(proxy.headers.get("access-control-allow-origin")).toBe(shell);
    expect(proxy.headers.get("access-control-allow-credentials")).toBe("true");

    const legacy = await worker.fetch(
      new Request("https://lvxu.test/api/auth/check", {
        headers: { authorization: "Bearer right-key", origin: legacyShellOrigin },
      }),
      env as never,
    );
    expect(legacy.status).toBe(200);
    expect(legacy.headers.get("set-cookie")).toBeNull();
    expect(legacy.headers.get("access-control-allow-origin")).toBe(legacyShellOrigin);
    expect(legacy.headers.get("access-control-allow-origin")).not.toBe("*");

    const site = await worker.fetch(
      new Request(`${workerOrigin}/api/auth/check`, {
        headers: { authorization: "Bearer right-key", origin: workerOrigin },
      }),
      env as never,
    );
    expect(site.status).toBe(200);
    expect(site.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(site.headers.get("access-control-allow-origin")).toBeNull();
  });
});
