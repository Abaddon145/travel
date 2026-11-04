// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { authorizePaidRequest, devBypassAllowed, type AccessEnv } from "./access";

const env: AccessEnv = {
  ENVIRONMENT: "production",
  ACCESS_DEV_BYPASS: "1",
  ACCESS_ALLOWED_EMAIL: "owner@example.com",
  TEAM_DOMAIN: "https://team.cloudflareaccess.com",
  POLICY_AUD: "aud-tag",
};

function requestWith(token?: string) {
  return new Request("https://lvxu.test/api/paid/draft", {
    method: "POST",
    headers: token ? { "cf-access-jwt-assertion": token } : {},
  });
}

describe("Access JWT", () => {
  it("生产环境忽略本地绕过", () => {
    expect(devBypassAllowed(env)).toBe(false);
    expect(devBypassAllowed({ ...env, ENVIRONMENT: "development" })).toBe(true);
  });

  it("拒绝缺失、无效和不在名单中的令牌", async () => {
    const verify = vi.fn(async () => ({ email: "other@example.com" }));
    await expect(authorizePaidRequest(requestWith(), env, verify)).resolves.toMatchObject(
      {
        ok: false,
        reason: "unauthorized",
      },
    );
    expect(verify).not.toHaveBeenCalled();

    verify.mockRejectedValueOnce(new Error("bad signature"));
    await expect(
      authorizePaidRequest(requestWith("not-a-jwt"), env, verify),
    ).resolves.toMatchObject({ ok: false, reason: "unauthorized" });

    verify.mockResolvedValueOnce({ email: "other@example.com" });
    await expect(
      authorizePaidRequest(requestWith("token"), env, verify),
    ).resolves.toMatchObject({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("接受名单内的身份", async () => {
    const verify = vi.fn(async () => ({ email: "Owner@example.com" }));
    await expect(
      authorizePaidRequest(requestWith("token"), env, verify),
    ).resolves.toMatchObject({
      ok: true,
      via: "jwt",
    });
  });

  it("未配置签发信息时失败关闭", async () => {
    const verify = vi.fn();
    const decision = await authorizePaidRequest(
      requestWith("token"),
      { ...env, POLICY_AUD: "" },
      verify,
    );
    expect(decision).toMatchObject({ ok: false, reason: "unconfigured" });
    expect(verify).not.toHaveBeenCalled();
  });
});
