import { verifyAccessJwt } from "./access";
import { handleAiRequest, type AiEnv, type UsageNamespace } from "./ai/http";
import { AiUsageLedger } from "./ai/usage-ledger";
import { handleApi } from "./api";
import { mapCookieHeader, mapCookieSecret } from "./map/cookie";
import { handleMapRequest } from "./map/http";
import { handleAmapProxy } from "./map/proxy";
import { createLogger } from "./redact";
import { applySecurityHeaders } from "./security-headers";

const log = createLogger();

type WorkerEnv = Env &
  AiEnv & {
    OWNER_KEY_SHA256?: string;
    DEEPSEEK_API_KEY?: string;
    AMAP_JS_KEY?: string;
    AMAP_JS_SECURITY_CODE?: string;
    AMAP_WEB_KEY?: string;
    AI_USAGE: UsageNamespace;
  };

export { AiUsageLedger };

export default {
  async fetch(request, env: WorkerEnv) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/_AMapService")) {
      return applySecurityHeaders(
        await handleAmapProxy(request, env, (input) => env.API_RATE_LIMIT.limit(input)),
      );
    }
    if (url.pathname.startsWith("/api/")) {
      let response = await handleApi(request, env, {
        verifyJwt: verifyAccessJwt,
        limit: (input) => env.API_RATE_LIMIT.limit(input),
        recordFailure: (input) => env.AUTH_FAILURE_LIMIT.limit(input),
        log,
        handleAi: (incoming) => handleAiRequest(incoming, env),
        handleMap: (incoming) => handleMapRequest(incoming, env),
      });
      if (
        response.ok &&
        (url.pathname === "/api/auth/check" || url.pathname === "/api/map/config")
      ) {
        const secret = mapCookieSecret(env);
        if (secret) {
          const headers = new Headers(response.headers);
          headers.append("set-cookie", await mapCookieHeader(secret));
          response = new Response(response.body, { status: response.status, headers });
        }
      }
      return applySecurityHeaders(response);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
