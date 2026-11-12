// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class DurableObject {},
}));

import { legacyShellOrigin, shellOrigin } from "../shared/shell-origin";
import worker from "./index";
import { mapCookieHeader } from "./map/cookie";
import { mintMapFrameToken } from "./map/frame-token";
import { sha256Bytes } from "./owner-key";

async function ownerHash(key: string) {
  const bytes = await sha256Bytes(key);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const marker = '<html><head><meta name="lvxu-map-frame" content="1" /></head></html>';

function envFor(hash: string, assets: ReturnType<typeof vi.fn>) {
  return {
    ENVIRONMENT: "production",
    AUTH_MODE: "owner-key",
    OWNER_KEY_SHA256: hash,
    ACCESS_DEV_BYPASS: "",
    AMAP_JS_KEY: "js-key",
    AMAP_JS_SECURITY_CODE: "server-only-code",
    AMAP_WEB_KEY: "web-key",
    API_RATE_LIMIT: { limit: async () => ({ success: true }) },
    AUTH_FAILURE_LIMIT: { limit: async () => ({ success: true }) },
    ASSETS: { fetch: assets },
  };
}

describe("地图页", () => {
  it("只在地图页放宽 frame-ancestors，其它路径仍拒绝嵌入", async () => {
    const assets = vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      if (url.pathname === "/map-frame.html")
        return new Response(marker, { status: 200 });
      return new Response("<html>app</html>", { status: 200 });
    });
    const env = envFor(await ownerHash("right-key"), assets);

    const page = await worker.fetch(
      new Request("https://lvxu.test/map-frame"),
      env as never,
    );
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('name="lvxu-map-frame"');
    const policy = page.headers.get("content-security-policy") ?? "";
    const ancestors =
      policy.split("; ").find((part) => part.startsWith("frame-ancestors ")) ?? "";
    expect(ancestors).toBe(`frame-ancestors ${shellOrigin} ${legacyShellOrigin}`);
    expect(policy).not.toContain("frame-ancestors 'none'");
    expect(policy).toContain("frame-src 'self' https://lvxu-ai-travel.lvxu.workers.dev");
    expect(page.headers.get("x-frame-options")).toBeNull();
    expect(page.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(assets).toHaveBeenCalled();
    const assetRequest = assets.mock.calls[0]?.[0] as Request;
    expect(new URL(assetRequest.url).pathname).toBe("/map-frame.html");

    const alias = await worker.fetch(
      new Request("https://lvxu.test/map-frame.html"),
      env as never,
    );
    expect(alias.status).toBe(200);
    expect(alias.headers.get("x-frame-options")).toBeNull();

    const missing = await worker.fetch(new Request("https://lvxu.test/map-frame"), {
      ...env,
      ASSETS: { fetch: async () => new Response("<html>app</html>", { status: 200 }) },
    } as never);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(missing.headers.get("x-frame-options")).toBe("DENY");

    const posted = await worker.fetch(
      new Request("https://lvxu.test/map-frame", { method: "POST" }),
      env as never,
    );
    expect(posted.status).toBe(405);
    expect(posted.headers.get("x-frame-options")).toBe("DENY");

    const home = await worker.fetch(new Request("https://lvxu.test/"), env as never);
    expect(home.status).toBe(200);
    expect(home.headers.get("content-security-policy")).toBeNull();
    expect(home.headers.get("x-frame-options")).toBeNull();

    const status = await worker.fetch(
      new Request("https://lvxu.test/api/status"),
      env as never,
    );
    expect(status.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(status.headers.get("x-frame-options")).toBe("DENY");

    const proxy = await worker.fetch(
      new Request("https://lvxu.test/_AMapService/v5/place/text"),
      env as never,
    );
    expect(proxy.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(proxy.headers.get("x-frame-options")).toBe("DENY");
  });

  it("地图令牌只放行底图配置和代理，其它门禁不变", async () => {
    const hash = await ownerHash("right-key");
    const assets = vi.fn(async () => new Response("app", { status: 200 }));
    const env = envFor(hash, assets);
    const minted = await mintMapFrameToken(hash);
    const tokenHeaders = { "x-lvxu-map-token": minted.token, origin: shellOrigin };

    const mintedResponse = await worker.fetch(
      new Request("https://lvxu.test/api/map/frame-token", {
        headers: { authorization: "Bearer right-key", origin: shellOrigin },
      }),
      env as never,
    );
    expect(mintedResponse.status).toBe(200);
    const body = (await mintedResponse.json()) as { token?: string };
    expect(body.token).toMatch(/^[0-9]{10,12}\.[0-9a-f]{64}$/);
    expect(JSON.stringify(body)).not.toContain("right-key");
    expect(JSON.stringify(body)).not.toContain("server-only-code");
    expect(JSON.stringify(body)).not.toContain("js-key");
    expect(mintedResponse.headers.get("set-cookie")).toBeNull();

    const config = await worker.fetch(
      new Request("https://lvxu.test/api/map/config", { headers: tokenHeaders }),
      env as never,
    );
    expect(config.status).toBe(200);
    await expect(config.json()).resolves.toMatchObject({
      key: "js-key",
      serviceHost: "/_AMapService",
    });
    expect(config.headers.get("set-cookie")).toBeNull();
    expect(config.headers.get("access-control-allow-origin")).toBe(shellOrigin);

    const webConfig = await worker.fetch(
      new Request("https://lvxu.test/api/map/config", {
        headers: { authorization: "Bearer right-key", origin: "https://lvxu.test" },
      }),
      env as never,
    );
    expect(webConfig.status).toBe(200);
    expect(webConfig.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(webConfig.headers.get("set-cookie")).not.toContain("SameSite=None");

    const route = await worker.fetch(
      new Request("https://lvxu.test/api/map/route?mode=walking", {
        headers: tokenHeaders,
      }),
      env as never,
    );
    expect(route.status).toBe(401);

    const renew = await worker.fetch(
      new Request("https://lvxu.test/api/map/frame-token", { headers: tokenHeaders }),
      env as never,
    );
    expect(renew.status).toBe(401);

    const ai = await worker.fetch(
      new Request("https://lvxu.test/api/ai/itinerary", {
        method: "POST",
        headers: tokenHeaders,
      }),
      env as never,
    );
    expect(ai.status).toBe(401);

    const check = await worker.fetch(
      new Request("https://lvxu.test/api/auth/check", { headers: tokenHeaders }),
      env as never,
    );
    expect(check.status).toBe(401);
    expect(check.headers.get("set-cookie")).toBeNull();

    let upstream = "";
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      upstream = String(input);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      const proxied = await worker.fetch(
        new Request("https://lvxu.test/_AMapService/v5/place/text?keywords=京都", {
          headers: { "x-lvxu-map-token": minted.token },
        }),
        env as never,
      );
      expect(proxied.status).toBe(200);
      expect(upstream).toContain("jscode=server-only-code");
      expect(upstream).not.toContain(minted.token);
      expect(upstream).not.toContain("right-key");
    } finally {
      globalThis.fetch = original;
    }

    const cookie = await mapCookieHeader(hash);
    expect(cookie).toContain("SameSite=Strict");
  });
});
