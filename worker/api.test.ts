// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AccessEnv } from "./access";
import { handleApi } from "./api";

const env: AccessEnv = {
  ENVIRONMENT: "production",
  ACCESS_DEV_BYPASS: "1",
  ACCESS_ALLOWED_EMAIL: "owner@example.com",
  TEAM_DOMAIN: "https://team.cloudflareaccess.com",
  POLICY_AUD: "aud-tag",
};

function call(
  path: string,
  init: RequestInit,
  overrides: Partial<AccessEnv> = {},
  verifyJwt = vi.fn(async () => ({ email: "owner@example.com" })),
  limit = vi.fn(async () => ({ success: true })),
) {
  const onAuthorizedPaid = vi.fn();
  const log = vi.fn();
  const response = handleApi(
    new Request(`https://lvxu.test${path}`, init),
    { ...env, ...overrides },
    {
      verifyJwt,
      limit,
      log,
      onAuthorizedPaid,
    },
  );
  return { response, onAuthorizedPaid, log, verifyJwt };
}

describe("API 门闩", () => {
  it("无效 JWT 不能进入付费处理", async () => {
    const verifyJwt = vi.fn(async () => {
      throw new Error("rejected");
    });
    const { response, onAuthorizedPaid } = call(
      "/api/paid/draft",
      { method: "POST", headers: { "cf-access-jwt-assertion": "bad" } },
      {},
      verifyJwt,
    );
    const result = await response;
    expect(result.status).toBe(401);
    expect(onAuthorizedPaid).not.toHaveBeenCalled();
    await expect(result.json()).resolves.toMatchObject({ auth: "unauthorized" });
  });

  it("限流发生在付费处理之前", async () => {
    const { response, onAuthorizedPaid } = call(
      "/api/paid/draft",
      { method: "POST", headers: { "cf-access-jwt-assertion": "good" } },
      {},
      vi.fn(async () => ({ email: "owner@example.com" })),
      vi.fn(async () => ({ success: false })),
    );
    const result = await response;
    expect(result.status).toBe(429);
    expect(onAuthorizedPaid).not.toHaveBeenCalled();
  });

  it("生产环境不接受本地绕过", async () => {
    const { response, onAuthorizedPaid } = call("/api/admin/health", { method: "GET" });
    expect((await response).status).toBe(401);
    expect(onAuthorizedPaid).not.toHaveBeenCalled();
  });

  it("开发绕过可以到达占位实现，但不会假装已经接上上游", async () => {
    const { response, onAuthorizedPaid } = call(
      "/api/paid/draft",
      { method: "POST" },
      { ENVIRONMENT: "development" },
    );
    const result = await response;
    expect(result.status).toBe(501);
    expect(onAuthorizedPaid).toHaveBeenCalledOnce();
  });

  it("状态接口不返回邮箱", async () => {
    const { response } = call(
      "/api/status",
      { method: "GET", headers: { authorization: "Bearer secret", cookie: "a=b" } },
      { POLICY_AUD: "" },
    );
    const body = await (await response).json();
    expect(body).toMatchObject({ auth: "unconfigured", paidApi: "locked" });
    expect(JSON.stringify(body)).not.toContain("@");
  });
});
