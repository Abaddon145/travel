import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { workerOrigin } from "./shared/shell-origin.ts";
import {
  injectContentSecurityPolicy,
  metaContentSecurityPolicy,
  renderHeadersFile,
  securityHeaders,
} from "./shared/security-headers.ts";

describe("静态资源安全头", () => {
  it("public/_headers 与共享策略一致", () => {
    const file = readFileSync("public/_headers", "utf8");
    expect(file).toBe(renderHeadersFile());
    for (const value of Object.values(securityHeaders)) {
      expect(file).toContain(value);
    }
    const policy = securityHeaders["content-security-policy"] ?? "";
    const scriptSrc =
      policy.split("; ").find((part) => part.startsWith("script-src ")) ?? "";
    expect(scriptSrc).toContain("https://*.amap.com");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(policy).toContain(workerOrigin);
    expect(metaContentSecurityPolicy()).toContain(workerOrigin);
    expect(metaContentSecurityPolicy()).toContain(`frame-src 'self' ${workerOrigin}`);
    expect(metaContentSecurityPolicy()).toContain(
      `child-src 'self' blob: ${workerOrigin}`,
    );
    expect(metaContentSecurityPolicy()).not.toContain("frame-ancestors");
    const html = injectContentSecurityPolicy("<html><head></head><body></body></html>");
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain(workerOrigin);
    expect(injectContentSecurityPolicy(html)).toBe(html);
    expect(file).toContain("Cache-Control: public, max-age=31536000, immutable");
    expect(file).toContain("/assets/*");
  });

  it("robots.txt 是真实文件，而不是页面外壳", () => {
    const file = readFileSync("public/robots.txt", "utf8");
    expect(file).toContain("User-agent: *");
    expect(file).toContain("Disallow: /");
    expect(file).not.toContain("<html");
  });
});
