// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { GateEnv } from "./owner-key";
import { sha256Bytes } from "./owner-key";
import { handleApi } from "./api";

const env: GateEnv = {
  ENVIRONMENT: "production",
  ACCESS_DEV_BYPASS: "1",
  ACCESS_ALLOWED_EMAIL: "owner@example.com",
  TEAM_DOMAIN: "https://team.cloudflareaccess.com",
  POLICY_AUD: "aud-tag",
  AUTH_MODE: "access",
};

async function ownerHash(key: string) {
  const bytes = await sha256Bytes(key);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function call(
  path: string,
  init: RequestInit,
  overrides: Partial<GateEnv> = {},
  verifyJwt = vi.fn(async () => ({ email: "owner@example.com" })),
  limit = vi.fn(async () => ({ success: true })),
  recordFailure = vi.fn(async () => ({ success: true })),
) {
  const onAuthorizedPaid = vi.fn();
  const log = vi.fn();
  const response = handleApi(
    new Request(`https://lvxu.test${path}`, init),
    { ...env, ...overrides },
    {
      verifyJwt,
      limit,
      recordFailure,
      log,
      onAuthorizedPaid,
    },
  );
  return { response, onAuthorizedPaid, log, verifyJwt, recordFailure };
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

describe("私人密钥门禁", () => {
  it("没有密钥指纹时失败关闭，且不计入错误次数", async () => {
    const { response, onAuthorizedPaid, recordFailure } = call(
      "/api/paid/draft",
      { method: "POST", headers: { authorization: "Bearer anything" } },
      { AUTH_MODE: "owner-key", OWNER_KEY_SHA256: "" },
    );
    const result = await response;
    expect(result.status).toBe(401);
    await expect(result.json()).resolves.toMatchObject({
      auth: "unauthorized",
      error: "unconfigured",
    });
    expect(onAuthorizedPaid).not.toHaveBeenCalled();
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it("错误或缺失的密钥返回 401，重复失败被限流为 429", async () => {
    const hash = await ownerHash("right-key");
    const recordFailure = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });
    const wrong = call(
      "/api/paid/draft",
      { method: "POST", headers: { authorization: "Bearer wrong-key" } },
      { AUTH_MODE: "owner-key", OWNER_KEY_SHA256: hash },
      undefined,
      undefined,
      recordFailure,
    );
    const first = await wrong.response;
    expect(first.status).toBe(401);
    expect(wrong.onAuthorizedPaid).not.toHaveBeenCalled();
    expect(JSON.stringify(wrong.log.mock.calls)).not.toContain("wrong-key");

    const missing = call(
      "/api/auth/check",
      { method: "GET" },
      { AUTH_MODE: "owner-key", OWNER_KEY_SHA256: hash },
      undefined,
      undefined,
      recordFailure,
    );
    expect((await missing.response).status).toBe(429);
    expect(missing.onAuthorizedPaid).not.toHaveBeenCalled();
  });

  it("正确密钥可以验证并到达付费占位，日志不含密钥", async () => {
    const hash = await ownerHash("right-key");
    const headers = { "x-lvxu-owner-key": "right-key" };
    const check = call(
      "/api/auth/check",
      { method: "GET", headers },
      { AUTH_MODE: "owner-key", OWNER_KEY_SHA256: hash },
    );
    const checked = await check.response;
    expect(checked.status).toBe(200);
    await expect(checked.json()).resolves.toEqual({ ok: true });
    expect(check.recordFailure).not.toHaveBeenCalled();
    expect(JSON.stringify(check.log.mock.calls)).not.toContain("right-key");

    const paid = call(
      "/api/paid/draft",
      { method: "POST", headers: { authorization: "Bearer right-key" } },
      { AUTH_MODE: "owner-key", OWNER_KEY_SHA256: hash },
    );
    const result = await paid.response;
    expect(result.status).toBe(501);
    expect(paid.onAuthorizedPaid).toHaveBeenCalledOnce();
  });

  it("状态接口报告模式和是否已配置，不返回指纹", async () => {
    const hash = await ownerHash("right-key");
    const missing = call("/api/status", { method: "GET" }, { AUTH_MODE: "owner-key" });
    const missingBody = await (await missing.response).json();
    expect(missingBody).toMatchObject({
      authMode: "owner-key",
      configured: false,
      auth: "unconfigured",
      paidApi: "locked",
    });

    const ready = call(
      "/api/status",
      { method: "GET", headers: { authorization: "Bearer wrong-key" } },
      { AUTH_MODE: "owner-key", OWNER_KEY_SHA256: hash },
    );
    const body = await (await ready.response).json();
    expect(body).toMatchObject({
      authMode: "owner-key",
      configured: true,
      auth: "unauthorized",
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(hash);
    expect(serialized).not.toContain("wrong-key");
    expect(ready.recordFailure).not.toHaveBeenCalled();
  });

  it("非生产的本地绕过在私人密钥模式下仍然可用", async () => {
    const { response, onAuthorizedPaid } = call(
      "/api/paid/draft",
      { method: "POST" },
      { AUTH_MODE: "owner-key", ENVIRONMENT: "development", OWNER_KEY_SHA256: "" },
    );
    expect((await response).status).toBe(501);
    expect(onAuthorizedPaid).toHaveBeenCalledOnce();
  });

  it("未知模式失败关闭", async () => {
    const { response, onAuthorizedPaid } = call(
      "/api/paid/draft",
      { method: "POST" },
      { AUTH_MODE: "open" },
    );
    const result = await response;
    expect(result.status).toBe(401);
    await expect(result.json()).resolves.toMatchObject({ error: "unconfigured" });
    expect(onAuthorizedPaid).not.toHaveBeenCalled();
  });

  it("Access 模式保持 JWT 门闩，either 接受任一方式", async () => {
    const hash = await ownerHash("right-key");
    const accessDenied = call(
      "/api/admin/health",
      { method: "GET", headers: { authorization: "Bearer right-key" } },
      { AUTH_MODE: "access", OWNER_KEY_SHA256: hash },
    );
    expect((await accessDenied.response).status).toBe(401);
    expect(accessDenied.recordFailure).not.toHaveBeenCalled();
    expect(accessDenied.verifyJwt).not.toHaveBeenCalled();

    const byKey = call(
      "/api/auth/check",
      { method: "GET", headers: { authorization: "Bearer right-key" } },
      { AUTH_MODE: "either", OWNER_KEY_SHA256: hash, POLICY_AUD: "" },
    );
    expect((await byKey.response).status).toBe(200);

    const byJwt = call(
      "/api/admin/health",
      { method: "GET", headers: { "cf-access-jwt-assertion": "token" } },
      { AUTH_MODE: "either", OWNER_KEY_SHA256: hash },
    );
    expect((await byJwt.response).status).toBe(200);
    expect(byJwt.verifyJwt).toHaveBeenCalledOnce();
  });
});
