import { verifyAccessJwt } from "./access";
import { handleApi } from "./api";
import { createLogger } from "./redact";

const log = createLogger();

type WorkerEnv = Env & {
  OWNER_KEY_SHA256?: string;
};

export default {
  async fetch(request, env: WorkerEnv) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, {
        verifyJwt: verifyAccessJwt,
        limit: (input) => env.API_RATE_LIMIT.limit(input),
        recordFailure: (input) => env.AUTH_FAILURE_LIMIT.limit(input),
        log,
      });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
