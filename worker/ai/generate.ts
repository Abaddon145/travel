import {
  draftSchema,
  issueList,
  preferenceSchema,
  type TravelDraft,
  type TravelPreference,
} from "../../shared/ai-schema";
import { completeJson, type TokenUsage } from "./deepseek";

export type GenerateErrorCode =
  | "not_configured"
  | "validation_error"
  | "invalid_output"
  | "timeout"
  | "network"
  | "rate_limited"
  | "upstream_auth"
  | "upstream_balance"
  | "upstream_rejected"
  | "upstream_unavailable";

export type GeneratedUsage = TokenUsage & {
  model: string;
  latencyMs: number;
  attempts: number;
};

export type GenerateResult =
  | {
      ok: true;
      draft: TravelDraft;
      usage: GeneratedUsage;
      charged: boolean;
    }
  | {
      ok: false;
      error: GenerateErrorCode;
      message: string;
      issues?: { path: string; message: string }[];
      usage: GeneratedUsage;
      charged: boolean;
    };

const SYSTEM_PROMPT = `你是旅序的行程编辑。只输出一个 json 对象，不要输出其他文字。
示例：
{"title":"京都两日","destination":"京都","startDate":"2026-11-10","endDate":"2026-11-11","summary":"寺与巷","warnings":["步行较多"],"days":[{"date":"2026-11-10","title":"东山","note":"","items":[{"kind":"place","name":"清水寺","area":"东山","note":"","timeLabel":"09:30","checkIn":"","checkOut":""},{"kind":"lodging","name":"町家","area":"祗园","note":"","timeLabel":"","checkIn":"2026-11-10","checkOut":"2026-11-11"}]}]}
日期必须从开始到结束连续各一天。kind 只能是 place 或 lodging。时间用 24 小时制，例如 09:30，没有就留空。文案使用简体中文。不要编造网址、票价或地图坐标。`;

const labels = {
  low: "节俭",
  medium: "适中",
  high: "宽裕",
  relaxed: "从容",
  moderate: "适中",
  packed: "紧凑",
} as const;

function zeroUsage(model: string): GeneratedUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    model,
    latencyMs: 0,
    attempts: 0,
  };
}

function addUsage(total: TokenUsage, next: TokenUsage): TokenUsage {
  return {
    promptTokens: total.promptTokens + next.promptTokens,
    completionTokens: total.completionTokens + next.completionTokens,
    totalTokens: total.totalTokens + next.totalTokens,
    cacheHitTokens: total.cacheHitTokens + next.cacheHitTokens,
    cacheMissTokens: total.cacheMissTokens + next.cacheMissTokens,
  };
}

export function preferencePrompt(preference: TravelPreference) {
  return [
    `目的地：${preference.destination}`,
    `日期：${preference.startDate} 至 ${preference.endDate}`,
    `人数：${preference.travelers}`,
    `预算：${labels[preference.budget]}`,
    `节奏：${labels[preference.pace]}`,
    `兴趣：${preference.interests.join("、") || "无"}`,
    `备注：${preference.notes || "无"}`,
    "请输出 json。",
  ].join("\n");
}

export function extractJson(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  try {
    return JSON.parse(fenced?.[1] ?? trimmed) as unknown;
  } catch {
    return null;
  }
}

export async function generateItinerary(input: {
  preferences: TravelPreference;
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
}): Promise<GenerateResult> {
  const model = input.model;
  const started = (input.now ?? Date.now)();
  const timeoutMs = input.timeoutMs ?? 25_000;
  const providedFetch = input.fetchImpl ?? fetch;
  const fetchImpl: typeof fetch = (request, init) => providedFetch.call(globalThis, request, init);
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = input.now ?? Date.now;
  if (!input.apiKey.trim()) {
    return {
      ok: false,
      error: "not_configured",
      message: "模型密钥还没配置",
      usage: zeroUsage(model),
      charged: false,
    };
  }

  const preference = preferenceSchema.safeParse(input.preferences);
  if (!preference.success) {
    return {
      ok: false,
      error: "validation_error",
      message: "请修正出行偏好",
      issues: issueList(preference.error),
      usage: zeroUsage(model),
      charged: false,
    };
  }

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: preferencePrompt(preference.data) },
  ];
  let tokens: TokenUsage = zeroUsage(model);
  let charged = false;
  let attempts = 0;
  let repairs = 0;

  while (attempts < 3) {
    if (now() - started >= timeoutMs) {
      return {
        ok: false,
        error: "timeout",
        message: "生成超时",
        usage: { ...tokens, model, latencyMs: now() - started, attempts },
        charged,
      };
    }
    attempts += 1;
    const remaining = timeoutMs - (now() - started);
    const signal = AbortSignal.timeout(Math.max(1, Math.min(20_000, remaining)));
    const completion = await completeJson({
      fetchImpl,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      model,
      messages,
      signal,
    });
    if (!completion.ok) {
      const reachedUpstream = completion.code !== "network" && completion.code !== "timeout";
      if (reachedUpstream) charged = true;
      if (completion.retryable && attempts < 3) {
        await sleep(400 * 2 ** (attempts - 1));
        continue;
      }
      return {
        ok: false,
        error: completion.code,
        message: completion.message,
        usage: { ...tokens, model, latencyMs: now() - started, attempts },
        charged,
      };
    }

    charged = true;
    tokens = addUsage(tokens, completion.usage);
    const parsed = extractJson(completion.content);
    const draft = parsed ? draftSchema.safeParse(parsed) : null;
    const truncated = completion.finishReason === "length";
    if (draft?.success && !truncated) {
      return {
        ok: true,
        draft: draft.data,
        usage: {
          ...tokens,
          model: completion.model,
          latencyMs: now() - started,
          attempts,
        },
        charged,
      };
    }
    if (repairs >= 2) {
      return {
        ok: false,
        error: "invalid_output",
        message: "草稿没有通过校验",
        issues: draft && !draft.success ? issueList(draft.error) : [],
        usage: { ...tokens, model: completion.model, latencyMs: now() - started, attempts },
        charged,
      };
    }
    repairs += 1;
    const issues =
      draft && !draft.success
        ? issueList(draft.error)
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join("\n")
        : truncated
          ? "输出被截断"
          : "不是合法 json";
    messages.push({
      role: "assistant",
      content: completion.content.slice(0, 4000) || "{}",
    });
    messages.push({
      role: "user",
      content: `上次的 json 没有通过校验：\n${issues}\n请只重新输出一个完整 json 对象。`,
    });
  }

  return {
    ok: false,
    error: "invalid_output",
    message: "草稿没有通过校验",
    usage: { ...tokens, model, latencyMs: now() - started, attempts },
    charged,
  };
}
