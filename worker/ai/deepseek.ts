import { AI_MODELS, type AiModel } from "../../shared/ai-schema";
import { redactForLog } from "../redact";

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
};

export type Completion =
  | {
      ok: true;
      content: string;
      finishReason: string;
      model: string;
      usage: TokenUsage;
    }
  | { ok: false; status: number; retryable: boolean; code: UpstreamCode; message: string };

export type UpstreamCode =
  | "upstream_auth"
  | "upstream_balance"
  | "rate_limited"
  | "upstream_rejected"
  | "upstream_unavailable"
  | "network"
  | "timeout";

const emptyUsage: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  cacheHitTokens: 0,
  cacheMissTokens: 0,
};

export function sanitizeSecrets(value: string) {
  return value.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}

export function isAiModel(value: string): value is AiModel {
  return (AI_MODELS as readonly string[]).includes(value);
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function readUsage(value: unknown): TokenUsage {
  if (!value || typeof value !== "object") return emptyUsage;
  const usage = value as Record<string, unknown>;
  return {
    promptTokens: numberField(usage.prompt_tokens),
    completionTokens: numberField(usage.completion_tokens),
    totalTokens: numberField(usage.total_tokens),
    cacheHitTokens: numberField(usage.prompt_cache_hit_tokens),
    cacheMissTokens: numberField(usage.prompt_cache_miss_tokens),
  };
}

function mapStatus(status: number): Pick<Extract<Completion, { ok: false }>, "code" | "message" | "retryable"> {
  if (status === 401) {
    return { code: "upstream_auth", message: "模型服务没有接受密钥。", retryable: false };
  }
  if (status === 402) {
    return { code: "upstream_balance", message: "模型账户余额不足。", retryable: false };
  }
  if (status === 429) {
    return { code: "rate_limited", message: "请求过于频繁。", retryable: true };
  }
  if (status === 400 || status === 422) {
    return { code: "upstream_rejected", message: "模型服务拒绝了这次请求。", retryable: false };
  }
  if (status >= 500) {
    return { code: "upstream_unavailable", message: "模型服务暂时不可用。", retryable: true };
  }
  return { code: "upstream_rejected", message: "模型服务拒绝了这次请求。", retryable: false };
}

function logFetchError(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  const message = sanitizeSecrets(error instanceof Error ? error.message : "unknown").slice(0, 200);
  console.log(
    JSON.stringify(
      redactForLog({
        source: "deepseek",
        errorName: name,
        errorMessage: message,
      }),
    ),
  );
}

export async function completeJson(input: {
  fetchImpl: typeof fetch;
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
}): Promise<Completion> {
  const url = `${input.baseUrl.replace(/\/$/, "")}/chat/completions`;
  let response: Response;
  try {
    // Workers throw Illegal invocation if fetch is called as a method of another object.
    const fetchImpl = input.fetchImpl;
    response = await fetchImpl.call(globalThis, url, {
      method: "POST",
      signal: input.signal,
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        response_format: { type: "json_object" },
        // Docs: omitting thinking enables reasoning. disabled is the non-thinking mode.
        thinking: { type: "disabled" },
        temperature: 0.4,
        max_tokens: 8192,
        stream: false,
      }),
    });
  } catch (error) {
    logFetchError(error);
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 0,
      retryable: true,
      code: aborted ? "timeout" : "network",
      message: aborted ? "生成超时，模型没有在限定时间内返回。" : "网络错误，没有连上模型服务。",
    };
  }

  if (!response.ok) {
    const mapped = mapStatus(response.status);
    return { ok: false, status: response.status, ...mapped };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      status: 502,
      retryable: true,
      code: "upstream_unavailable",
      message: "模型服务暂时不可用",
    };
  }
  const body = payload as {
    model?: unknown;
    choices?: {
      message?: { content?: unknown; reasoning_content?: unknown };
      finish_reason?: unknown;
    }[];
    usage?: unknown;
  };
  const message = body.choices?.[0]?.message;
  const content = typeof message?.content === "string" ? message.content : "";
  return {
    ok: true,
    content,
    finishReason: typeof body.choices?.[0]?.finish_reason === "string"
      ? body.choices[0].finish_reason
      : "",
    model: typeof body.model === "string" ? body.model : input.model,
    usage: readUsage(body.usage),
  };
}
