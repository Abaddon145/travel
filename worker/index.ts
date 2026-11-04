import { verifyAccessJwt } from "./access";
import { handleApi } from "./api";
import { createLogger } from "./redact";

const log = createLogger();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, {
        verifyJwt: verifyAccessJwt,
        limit: (input) => env.API_RATE_LIMIT.limit(input),
        log,
      });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
