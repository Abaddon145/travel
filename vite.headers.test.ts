import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderHeadersFile, securityHeaders } from "./shared/security-headers.ts";

describe("静态资源安全头", () => {
  it("public/_headers 与共享策略一致", () => {
    const file = readFileSync("public/_headers", "utf8");
    expect(file).toBe(renderHeadersFile());
    for (const value of Object.values(securityHeaders)) {
      expect(file).toContain(value);
    }
  });
});
