import {
  accessConfigured,
  authorizePaidRequest,
  devBypassAllowed,
  type AccessEnv,
  type AccessIdentity,
} from "./access";
import { enforceRateLimit, rateLimitKey, type RateLimiter } from "./rate-limit";

export type ApiDeps = {
  verifyJwt: (token: string, env: AccessEnv) => Promise<AccessIdentity>;
  limit: RateLimiter["limit"];
  log: (event: Record<string, unknown>) => void;
  onAuthorizedPaid?: () => void;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

export async function handleApi(request: Request, env: AccessEnv, deps: ApiDeps) {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  const decision = await authorizePaidRequest(request, env, deps.verifyJwt);
  const identityEmail = decision.ok ? (decision.identity?.email ?? null) : null;
  const key = await rateLimitKey(identityEmail, clientIp(request));
  const limited = (await enforceRateLimit({ limit: deps.limit }, key)) === "limited";
  if (limited) {
    deps.log({ route, status: 429, result: "rate_limited" });
    return json({ auth: "rate_limited", error: "rate_limited" }, 429);
  }

  if (url.pathname === "/api/status" && request.method === "GET") {
    const auth = devBypassAllowed(env)
      ? "connected"
      : !accessConfigured(env)
        ? "unconfigured"
        : decision.ok
          ? "connected"
          : "unauthorized";
    deps.log({ route, status: 200, result: auth });
    return json({
      service: "lvxu",
      environment: env.ENVIRONMENT,
      auth,
      paidApi: "locked",
    });
  }

  const paid =
    url.pathname === "/api/paid/draft" ||
    url.pathname.startsWith("/api/paid/") ||
    url.pathname === "/api/admin/health" ||
    url.pathname.startsWith("/api/admin/");

  if (paid) {
    if (!decision.ok) {
      const status = decision.reason === "unconfigured" ? 401 : 401;
      deps.log({ route, status, result: decision.reason });
      return json({ auth: "unauthorized", error: decision.reason }, status);
    }
    deps.onAuthorizedPaid?.();
    if (url.pathname === "/api/admin/health" && request.method === "GET") {
      deps.log({ route, status: 200, result: "ok" });
      return json({ ok: true });
    }
    if (url.pathname === "/api/paid/draft" && request.method === "POST") {
      deps.log({ route, status: 501, result: "not_configured" });
      return json({ auth: "connected", error: "not_configured" }, 501);
    }
    deps.log({ route, status: 405, result: "method_not_allowed" });
    return json({ error: "method_not_allowed" }, 405);
  }

  if (url.pathname.startsWith("/api/")) {
    deps.log({ route, status: 404, result: "not_found" });
    return json({ error: "not_found" }, 404);
  }

  deps.log({ route, status: 404, result: "not_found" });
  return json({ error: "not_found" }, 404);
}
