// @vitest-environment node
import { describe, expect, it } from "vitest";
import { legacyShellOrigin, shellOrigin } from "../shared/shell-origin";
import {
  applySecurityHeaders,
  shellFrameContentSecurityPolicy,
} from "./security-headers";

describe("安全响应头", () => {
  it("补上策略头，且不改写已有的缓存指令", async () => {
    const response = applySecurityHeaders(
      new Response("{}", {
        status: 200,
        headers: {
          "cache-control": "public, max-age=60",
          "content-type": "application/json",
        },
      }),
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
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
    expect(directive("connect-src")).toContain("https://api.open-meteo.com");
    expect(directive("connect-src")).toContain("https://lvxu-ai-travel.lvxu.workers.dev");
    expect(directive("connect-src")).toContain("'self'");
    expect(directive("img-src")).toContain("https://lvxu-ai-travel.lvxu.workers.dev");
    expect(directive("style-src")).toBe("style-src 'self' 'unsafe-inline'");
    expect(directive("worker-src")).toBe("worker-src 'self' blob:");
    expect(directive("frame-src")).toBe(
      "frame-src 'self' https://lvxu-ai-travel.lvxu.workers.dev",
    );
    expect(directive("child-src")).toBe(
      "child-src 'self' blob: https://lvxu-ai-travel.lvxu.workers.dev",
    );
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("只有地图页允许壳来源嵌入，其它响应仍拒绝被嵌入", () => {
    const denied = applySecurityHeaders(
      new Response("page", { headers: { "x-frame-options": "SAMEORIGIN" } }),
    );
    expect(denied.headers.get("x-frame-options")).toBe("DENY");
    expect(denied.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );

    const framed = applySecurityHeaders(
      new Response("<html></html>", {
        headers: {
          "x-frame-options": "DENY",
          "content-security-policy": "frame-ancestors 'none'",
        },
      }),
      { framing: "shell" },
    );
    const policy = framed.headers.get("content-security-policy") ?? "";
    const ancestors =
      policy.split("; ").find((part) => part.startsWith("frame-ancestors ")) ?? "";
    expect(ancestors).toBe(shellFrameContentSecurityPolicy().split("; ").at(-1));
    expect(ancestors).toBe(`frame-ancestors ${shellOrigin} ${legacyShellOrigin}`);
    expect(policy).not.toContain("frame-ancestors 'none'");
    expect(policy).toContain("script-src 'self' https://webapi.amap.com");
    expect(framed.headers.get("x-frame-options")).toBeNull();
    expect(ancestors).not.toContain("*");
    expect(ancestors).not.toContain("https:");
  });
});
