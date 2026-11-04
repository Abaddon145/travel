import { createRemoteJWKSet, jwtVerify } from "jose";

export type AccessEnv = {
  ENVIRONMENT: string;
  ACCESS_DEV_BYPASS?: string;
  ACCESS_ALLOWED_EMAIL: string;
  TEAM_DOMAIN: string;
  POLICY_AUD: string;
};

export type AccessIdentity = {
  email: string;
};

export type AccessDecision =
  | { ok: true; identity: AccessIdentity | null; via: "jwt" | "dev-bypass" }
  | { ok: false; reason: "unauthorized" | "unconfigured" };

export function devBypassAllowed(env: AccessEnv) {
  return env.ENVIRONMENT !== "production" && env.ACCESS_DEV_BYPASS === "1";
}

export function accessConfigured(env: AccessEnv) {
  return Boolean(env.TEAM_DOMAIN && env.POLICY_AUD && env.ACCESS_ALLOWED_EMAIL);
}

export function emailAllowed(email: string, allowlist: string) {
  const expected = allowlist.trim().toLowerCase();
  const actual = email.trim().toLowerCase();
  return expected.length > 0 && actual === expected;
}

export async function verifyAccessJwt(
  token: string,
  env: AccessEnv,
): Promise<AccessIdentity> {
  const jwks = createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: env.TEAM_DOMAIN,
    audience: env.POLICY_AUD,
  });
  const email = typeof payload.email === "string" ? payload.email : "";
  return { email };
}

export async function authorizePaidRequest(
  request: Request,
  env: AccessEnv,
  verify: (token: string, env: AccessEnv) => Promise<AccessIdentity> = verifyAccessJwt,
): Promise<AccessDecision> {
  if (devBypassAllowed(env)) {
    return { ok: true, identity: null, via: "dev-bypass" };
  }
  if (!accessConfigured(env)) {
    return { ok: false, reason: "unconfigured" };
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return { ok: false, reason: "unauthorized" };
  try {
    const identity = await verify(token, env);
    if (!emailAllowed(identity.email, env.ACCESS_ALLOWED_EMAIL)) {
      return { ok: false, reason: "unauthorized" };
    }
    return { ok: true, identity, via: "jwt" };
  } catch {
    return { ok: false, reason: "unauthorized" };
  }
}
