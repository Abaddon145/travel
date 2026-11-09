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
});
