// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applySecurityHeaders } from "./security-headers";

describe("安全响应头", () => {
  it("补上策略头，且不改写已有的缓存指令", async () => {
    const response = applySecurityHeaders(
      new Response("{}", {
        status: 200,
        headers: { "cache-control": "public, max-age=60", "content-type": "application/json" },
      }),
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=15552000; includeSubDomains",
    );
    expect(response.headers.get("x-xss-protection")).toBe("0");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("permissions-policy")).toContain("geolocation=()");
    const policy = response.headers.get("content-security-policy") ?? "";
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("require-corp");
    expect(policy).not.toMatch(/sk-|BEGIN |AKIA|AIza/);
    expect(await response.text()).toBe("{}");
  });

  it("script-src 覆盖高德二级脚本域名", () => {
    const response = applySecurityHeaders(new Response(null));
    const policy = response.headers.get("content-security-policy") ?? "";
    const directive = (name: string) =>
      policy.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
    const scriptSrc = directive("script-src");
    expect(scriptSrc).toBe(
      "script-src 'self' https://webapi.amap.com https://*.amap.com 'unsafe-eval'",
    );
    expect(scriptSrc).toContain("https://*.amap.com");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(directive("font-src")).toBe("font-src 'self' data: https://*.amap.com");
    expect(directive("img-src")).toContain("https://*.autonavi.com");
    expect(directive("connect-src")).toContain("https://*.autonavi.com");
    expect(directive("connect-src")).toContain("blob:");
    expect(directive("style-src")).toBe("style-src 'self' 'unsafe-inline'");
    expect(directive("worker-src")).toBe("worker-src 'self' blob:");
  });
});
