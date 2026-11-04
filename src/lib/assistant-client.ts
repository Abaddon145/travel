import type { AiModel } from "@shared/ai-schema";
import type { PatchOp } from "@shared/revise-schema";
import type { PricedUsage } from "@/lib/ai-cost";
import type { AiFailure } from "@/lib/ai-client";
import { gatedHeaders } from "@/lib/owner-key";

export type ReviseSuccess = {
  ok: true;
  message: string;
  ops: PatchOp[];
  rejected: PatchOp[];
  usage: PricedUsage;
};

export type ReviseFailure = {
  ok: false;
  error: AiFailure | "locked_violation";
  message: string;
};

const failures = new Set<string>([
  "unauthorized",
  "not_configured",
  "validation_error",
  "invalid_output",
  "rate_limited",
  "quota_exceeded",
  "timeout",
  "network",
  "upstream_auth",
  "upstream_balance",
  "upstream_unavailable",
  "upstream_rejected",
]);

function failureOf(value: unknown): AiFailure | "locked_violation" {
  if (value === "locked_violation") return "locked_violation";
  return typeof value === "string" && failures.has(value) ? (value as AiFailure) : "network";
}

export async function requestRevision(body: unknown): Promise<ReviseSuccess | ReviseFailure> {
  let response: Response;
  try {
    response = await fetch("/api/ai/revise", {
      method: "POST",
      headers: gatedHeaders("/api/ai/revise", {
        accept: "application/json",
        "content-type": "application/json",
      }),
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: "network", message: "网络错误，没有连上模型服务。" };
  }
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
    ops?: unknown;
    rejected?: unknown;
    usage?: PricedUsage;
  } | null;
  if (!response.ok || !payload || !Array.isArray(payload.ops)) {
    return {
      ok: false,
      error: failureOf(payload?.error),
      message: typeof payload?.message === "string" ? payload.message : "调整没有完成。",
    };
  }
  const model: AiModel = payload.usage?.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-flash";
  return {
    ok: true,
    message: typeof payload.message === "string" ? payload.message : "可以看看这些调整。",
    ops: payload.ops as PatchOp[],
    rejected: Array.isArray(payload.rejected) ? (payload.rejected as PatchOp[]) : [],
    usage: payload.usage ?? {
      model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      latencyMs: 0,
      attempts: 1,
    },
  };
}
