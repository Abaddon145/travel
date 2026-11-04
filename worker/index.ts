import { verifyAccessJwt } from "./access";
import { handleAiRequest, type AiEnv, type UsageNamespace } from "./ai/http";
import { AiUsageLedger } from "./ai/usage-ledger";
import { handleApi } from "./api";
import { createLogger } from "./redact";

const log = createLogger();

type WorkerEnv = Env &
  AiEnv & {
    OWNER_KEY_SHA256?: string;
    DEEPSEEK_API_KEY?: string;
    AI_USAGE: UsageNamespace;
  };

export { AiUsageLedger };

export default {
  async fetch(request, env: WorkerEnv) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, {
        verifyJwt: verifyAccessJwt,
        limit: (input) => env.API_RATE_LIMIT.limit(input),
        recordFailure: (input) => env.AUTH_FAILURE_LIMIT.limit(input),
        log,
        handleAi: (incoming) => handleAiRequest(incoming, env),
      });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
