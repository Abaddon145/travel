// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mapCookieHeader, mapCookieValid } from "./cookie";
import { handleAmapProxy } from "./proxy";

const env = {
  ENVIRONMENT: "production",
  OWNER_KEY_SHA256: "ab".repeat(32),
  AMAP_JS_SECURITY_CODE: "server-only-code",
};

describe("地图代理", () => {
  it("没有 cookie 时拒绝，有签名 cookie 才追加 jscode", async () => {
    const blocked = await handleAmapProxy(
      new Request("https://lvxu.test/_AMapService/v5/place/text?keywords=京都"),
      env,
      async () => ({ success: true }),
    );
    expect(blocked.status).toBe(401);

    const header = await mapCookieHeader(env.OWNER_KEY_SHA256);
    expect(await mapCookieValid(env.OWNER_KEY_SHA256, header.split(";")[0] ?? "")).toBe(true);
    let seen = "";
    function strictFetch(this: unknown, input: URL) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      seen = input.toString();
      return new Response("{}", { status: 200 });
    }
    const allowed = await handleAmapProxy(
      new Request("https://lvxu.test/_AMapService/v5/place/text?keywords=京都", {
        headers: { cookie: header.split(";")[0] },
      }),
      env,
      async () => ({ success: true }),
      strictFetch as unknown as typeof fetch,
    );
    expect(allowed.status).toBe(200);
    expect(seen).toContain("https://restapi.amap.com/v5/place/text");
    expect(seen).toContain("jscode=server-only-code");
    expect(seen).not.toContain("OWNER_KEY");
  });

  it("缺少安全密钥时失败关闭", async () => {
    const response = await handleAmapProxy(
      new Request("https://lvxu.test/_AMapService/v3/place/text"),
      { ...env, AMAP_JS_SECURITY_CODE: "" },
      async () => ({ success: true }),
    );
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({ error: "not_configured" });
  });
});
