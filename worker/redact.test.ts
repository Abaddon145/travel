// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createLogger, redactForLog } from "./redact";

describe("日志脱敏", () => {
  it("去掉授权、cookie、邮箱和密钥字段", () => {
    const redacted = redactForLog({
      route: "POST /api/paid/draft",
      authorization: "Bearer secret-token",
      cookie: "CF_Authorization=jwt",
      email: "owner@example.com",
      nested: {
        "cf-access-jwt-assertion": "header.payload.signature",
        note: "owner@example.com",
        apiKey: "abcdefghijklmnopqrstuvwxyz012345",
      },
    }) as {
      route: string;
      authorization: string;
      cookie: string;
      email: string;
      nested: { note: string; apiKey: string };
    };

    expect(redacted.route).toBe("POST /api/paid/draft");
    expect(redacted.authorization).toBe("[redacted]");
    expect(redacted.cookie).toBe("[redacted]");
    expect(redacted.email).toBe("[redacted]");
    expect(redacted.nested.note).toBe("[redacted]");
    expect(redacted.nested.apiKey).toBe("[redacted]");
    expect(JSON.stringify(redacted)).not.toContain("owner@example.com");
    expect(JSON.stringify(redacted)).not.toContain("Bearer");
  });

  it("写出前再滤一遍", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    createLogger()({ authorization: "secret", path: "/api/status" });
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain("[redacted]");
    expect(line).not.toContain("secret");
    spy.mockRestore();
  });
});
