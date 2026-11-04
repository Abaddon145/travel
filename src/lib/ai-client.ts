import { draftSchema, type TravelDraft, type TravelPreference } from "@shared/ai-schema";
import { gatedHeaders } from "@/lib/owner-key";
import type { PricedUsage } from "@/lib/ai-cost";

export type AiFailure =
  | "unauthorized"
  | "not_configured"
  | "validation_error"
  | "invalid_output"
  | "rate_limited"
  | "quota_exceeded"
  | "timeout"
  | "network"
  | "upstream_auth"
  | "upstream_balance"
  | "upstream_unavailable"
  | "upstream_rejected";

export type ItineraryResult =
  | { ok: true; draft: TravelDraft; usage: PricedUsage }
  | { ok: false; error: AiFailure; message: string };

const failures = new Set<AiFailure>([
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

function asFailure(value: unknown): AiFailure {
  return typeof value === "string" && failures.has(value as AiFailure)
    ? (value as AiFailure)
    : "network";
}

export async function requestItinerary(preference: TravelPreference): Promise<ItineraryResult> {
  let response: Response;
  try {
    response = await fetch("/api/ai/itinerary", {
      method: "POST",
      headers: gatedHeaders("/api/ai/itinerary", {
        accept: "application/json",
        "content-type": "application/json",
      }),
      body: JSON.stringify(preference),
    });
  } catch {
    return { ok: false, error: "network", message: "网络错误，没有连上模型服务。" };
  }
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
    draft?: unknown;
    usage?: PricedUsage;
  } | null;
  if (response.status === 401) {
    return { ok: false, error: "unauthorized", message: "未授权。请先在「我的」里保存并通过私人密钥。" };
  }
  if (!response.ok || !body) {
    const error = asFailure(body?.error);
    return {
      ok: false,
      error,
      message: typeof body?.message === "string" ? body.message : "没有生成草稿",
    };
  }
  const draft = draftSchema.safeParse(body.draft);
  if (!draft.success || !body.usage) {
    return { ok: false, error: "invalid_output", message: "草稿没有通过校验" };
  }
  return { ok: true, draft: draft.data, usage: body.usage };
}

export type ServerUsage = {
  configured: boolean;
  caps: { dailyRequests: number; dailyTokens: number };
  today: { requests: number; tokens: number };
  month: { requests: number; tokens: number };
};

export async function readServerUsage(): Promise<ServerUsage | null> {
  try {
    const response = await fetch("/api/ai/usage", {
      headers: gatedHeaders("/api/ai/usage", { accept: "application/json" }),
    });
    if (!response.ok) return null;
    return (await response.json()) as ServerUsage;
  } catch {
    return null;
  }
}
