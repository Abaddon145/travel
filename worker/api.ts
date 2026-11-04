import { devBypassAllowed, type AccessEnv, type AccessIdentity } from "./access";
import { authorizeGate, gateConfigured, type GateDecision } from "./gate";
import { parseAuthMode, type GateEnv } from "./owner-key";
import { isAiRoute } from "./ai/http";
import { isMapRoute } from "./map/http";
import { enforceRateLimit, rateLimitKey, type RateLimiter } from "./rate-limit";

export type ApiDeps = {
  verifyJwt: (token: string, env: AccessEnv) => Promise<AccessIdentity>;
  limit: RateLimiter["limit"];
  recordFailure?: RateLimiter["limit"];
  log: (event: Record<string, unknown>) => void;
  onAuthorizedPaid?: () => void;
  handleAi?: (request: Request) => Promise<Response>;
  handleMap?: (request: Request) => Promise<Response>;
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

function isGatedPath(pathname: string) {
  return (
    pathname === "/api/auth/check" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/paid/draft" ||
    pathname.startsWith("/api/paid/") ||
    pathname === "/api/ai/itinerary" ||
    pathname === "/api/ai/usage" ||
    pathname.startsWith("/api/ai/") ||
    pathname.startsWith("/api/map/") ||
    pathname === "/api/admin/health" ||
    pathname.startsWith("/api/admin/")
  );
}

function statusAuth(env: GateEnv, decision: GateDecision) {
  if (devBypassAllowed(env)) return "connected";
  if (!parseAuthMode(env.AUTH_MODE) || !gateConfigured(env)) return "unconfigured";
  if (decision.ok) return "connected";
  return decision.reason === "unconfigured" ? "unconfigured" : "unauthorized";
}

export async function handleApi(request: Request, env: GateEnv, deps: ApiDeps) {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;
  const decision = await authorizeGate(request, env, deps.verifyJwt);
  const identityEmail = decision.ok ? (decision.identity?.email ?? null) : null;
  const key = await rateLimitKey(identityEmail, clientIp(request));
  const limited = (await enforceRateLimit({ limit: deps.limit }, key)) === "limited";
  if (limited) {
    deps.log({ route, status: 429, result: "rate_limited" });
    return json({ auth: "rate_limited", error: "rate_limited" }, 429);
  }

  if (url.pathname === "/api/status" && request.method === "GET") {
    const auth = statusAuth(env, decision);
    deps.log({ route, status: 200, result: auth });
    return json({
      service: "lvxu",
      environment: env.ENVIRONMENT,
      authMode: parseAuthMode(env.AUTH_MODE),
      configured: gateConfigured(env),
      auth,
      paidApi: "locked",
    });
  }

  if (isGatedPath(url.pathname)) {
    if (!decision.ok) {
      if (decision.ownerKeyFailure) {
        const failureKey = await rateLimitKey(null, `auth-fail:${clientIp(request)}`);
        const record = deps.recordFailure ?? (async () => ({ success: true }));
        const blocked =
          (await enforceRateLimit({ limit: record }, failureKey)) === "limited";
        if (blocked) {
          deps.log({ route, status: 429, result: "rate_limited" });
          return json({ auth: "rate_limited", error: "rate_limited" }, 429);
        }
      }
      deps.log({ route, status: 401, result: decision.reason });
      return json({ auth: "unauthorized", error: decision.reason }, 401);
    }

    if (url.pathname === "/api/auth/check" && request.method === "GET") {
      deps.log({ route, status: 200, result: "ok" });
      return json({ ok: true });
    }

    deps.onAuthorizedPaid?.();
    if (isAiRoute(url.pathname, request.method) && deps.handleAi) {
      return deps.handleAi(request);
    }
    if (isMapRoute(url.pathname) && deps.handleMap) {
      return deps.handleMap(request);
    }
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
