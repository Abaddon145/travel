import { issueList, preferenceSchema, shanghaiDay } from "../../shared/ai-schema";
import { isAiModel } from "./deepseek";
import { generateItinerary } from "./generate";
import { DEFAULT_REQUEST_CAP, DEFAULT_TOKEN_CAP, parseCap } from "./quota";

const BODY_LIMIT = 8_192;

export type UsageStub = {
  reserve(input: {
    today: string;
    requestCap: number;
    tokenCap: number;
  }): Promise<{
    ok: boolean;
    today: { requests: number; tokens: number };
    month: { requests: number; tokens: number };
  }>;
  commit(input: { today: string; tokens: number }): Promise<unknown>;
  release(input: { today: string }): Promise<unknown>;
  summary(input: { today: string }): Promise<{
    today: { requests: number; tokens: number };
    month: { requests: number; tokens: number };
  }>;
};

export type UsageNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): UsageStub;
};

export type AiEnv = {
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  AI_DAILY_REQUEST_CAP?: string;
  AI_DAILY_TOKEN_CAP?: string;
  AI_USAGE?: UsageNamespace;
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

function statusFor(error: string) {
  if (error === "not_configured") return 501;
  if (error === "validation_error") return 422;
  if (error === "quota_exceeded" || error === "rate_limited") return 429;
  if (error === "timeout") return 504;
  if (error === "upstream_balance") return 402;
  return 502;
}

function stub(env: AiEnv) {
  if (!env.AI_USAGE) return null;
  return env.AI_USAGE.get(env.AI_USAGE.idFromName("lvxu-owner"));
}

export function isAiRoute(pathname: string, method: string) {
  if (method === "GET" && pathname === "/api/ai/usage") return true;
  if (method === "POST" && (pathname === "/api/ai/itinerary" || pathname === "/api/paid/draft")) {
    return true;
  }
  return false;
}

export async function handleAiRequest(
  request: Request,
  env: AiEnv,
  fetchImpl: typeof fetch = fetch,
) {
  const url = new URL(request.url);
  const caps = {
    dailyRequests: parseCap(env.AI_DAILY_REQUEST_CAP, DEFAULT_REQUEST_CAP),
    dailyTokens: parseCap(env.AI_DAILY_TOKEN_CAP, DEFAULT_TOKEN_CAP),
  };
  const today = shanghaiDay();
  const ledger = stub(env);

  if (url.pathname === "/api/ai/usage" && request.method === "GET") {
    const summary = ledger
      ? await ledger.summary({ today })
      : { today: { requests: 0, tokens: 0 }, month: { requests: 0, tokens: 0 } };
    return json({
      configured: Boolean(env.DEEPSEEK_API_KEY?.trim()),
      caps,
      ...summary,
    });
  }

  if (!env.DEEPSEEK_API_KEY?.trim()) {
    return json(
      { error: "not_configured", message: "模型密钥还没配置" },
      501,
    );
  }
  if (!ledger) {
    return json({ error: "not_configured", message: "用量账本还没配置" }, 501);
  }

  const raw = await request.text().catch(() => null);
  if (raw === null) {
    return json({ error: "validation_error", message: "无法读取请求" }, 422);
  }
  if (raw.length > BODY_LIMIT) {
    return json({ error: "validation_error", message: "请求过大" }, 422);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "validation_error", message: "请求不是 json" }, 422);
  }
  const parsed = preferenceSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        error: "validation_error",
        message: "请修正出行偏好",
        issues: issueList(parsed.error),
      },
      422,
    );
  }

  const reserved = await ledger.reserve({
    today,
    requestCap: caps.dailyRequests,
    tokenCap: caps.dailyTokens,
  });
  if (!reserved.ok) {
    return json(
      {
        error: "quota_exceeded",
        message: "今日生成额度已用完",
        caps,
        today: reserved.today,
        month: reserved.month,
      },
      429,
    );
  }

  const requested = parsed.data.model;
  const configured = env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
  const model = requested && isAiModel(requested)
    ? requested
    : isAiModel(configured)
      ? configured
      : "deepseek-flash";

  try {
    const result = await generateItinerary({
      preferences: parsed.data,
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com",
      model,
      fetchImpl,
    });
    if (result.charged) {
      await ledger.commit({ today, tokens: result.usage.totalTokens });
    } else {
      await ledger.release({ today });
    }
    if (!result.ok) {
      return json(
        {
          error: result.error,
          message: result.message,
          issues: result.issues,
          usage: result.usage,
        },
        statusFor(result.error),
      );
    }
    return json({ draft: result.draft, usage: result.usage });
  } catch {
    await ledger.release({ today });
    return json({ error: "network", message: "网络错误" }, 502);
  }
}
