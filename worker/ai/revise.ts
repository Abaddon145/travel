import {
  assistantReplySchema,
  splitLockedOps,
  type PatchOp,
  type ReviseRequest,
} from "../../shared/revise-schema";
import { completeJson, type TokenUsage } from "./deepseek";
import { extractJson, type GenerateErrorCode, type GeneratedUsage } from "./generate";

export type ReviseResult =
  | {
      ok: true;
      message: string;
      ops: PatchOp[];
      rejected: PatchOp[];
      usage: GeneratedUsage;
      charged: boolean;
    }
  | {
      ok: false;
      error: GenerateErrorCode | "locked_violation";
      message: string;
      usage: GeneratedUsage;
      charged: boolean;
    };

const SYSTEM_PROMPT = `你是旅序的行程助手。只输出一个 json 对象，不要输出其他文字。
示例：
{"message":"把傍晚的安排放宽。","ops":[{"op":"update","itemId":"item-2","timeLabel":"18:30"}]}
op 只能是 add、remove、move、update。add 需要 dayId、kind、name、area、note、timeLabel、order。remove 只需要 itemId。move 需要 itemId、dayId、order。update 需要 itemId，以及要改的 name、area、note 或 timeLabel。
不要改、删、移动任何 locked 为 true 的项目，也不要改锁定的全天或锁定时段里的项目。不要编造距离、时长、坐标或票价。文案使用简体中文。`;

function withUsage(usage: TokenUsage, model: string, latencyMs: number, attempts: number): GeneratedUsage {
  return { ...usage, model, latencyMs, attempts };
}

const emptyTokens = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  cacheHitTokens: 0,
  cacheMissTokens: 0,
};

export function revisePrompt(request: ReviseRequest) {
  return [
    `指令：${request.instruction}`,
    `范围日期：${request.scope.dayId || "未指定"}`,
    `范围项目：${request.scope.itemIds.join("、") || "未指定"}`,
    "当前行程 json：",
    JSON.stringify(request.trip),
    "请输出 json。",
  ].join("\n");
}

export async function reviseItinerary(input: {
  request: ReviseRequest;
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl: typeof fetch;
}): Promise<ReviseResult> {
  const started = Date.now();
  const completion = await completeJson({
    fetchImpl: input.fetchImpl,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    model: input.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...input.request.history.map((turn) => ({ role: turn.role, content: turn.text })),
      { role: "user", content: revisePrompt(input.request) },
    ],
    signal: AbortSignal.timeout(20_000),
  });
  const latencyMs = Date.now() - started;
  if (!completion.ok) {
    return {
      ok: false,
      error: completion.code,
      message: completion.message,
      usage: withUsage(emptyTokens, input.model, latencyMs, 1),
      charged: completion.status > 0,
    };
  }
  const parsed = assistantReplySchema.safeParse(extractJson(completion.content));
  const usage = withUsage(completion.usage, completion.model || input.model, latencyMs, 1);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_output",
      message: "模型没有返回可用的调整。",
      usage,
      charged: true,
    };
  }
  const view = {
    days: input.request.trip.days.map((day) => ({
      id: day.id,
      locked: day.locked,
      lockedFrom: day.lockedFrom,
      lockedTo: day.lockedTo,
    })),
    items: input.request.trip.days.flatMap((day) =>
      day.items.map((item) => ({
        id: item.id,
        dayId: day.id,
        timeLabel: item.timeLabel,
        locked: item.locked,
      })),
    ),
  };
  const { kept, rejected } = splitLockedOps(view, parsed.data.ops);
  if (parsed.data.ops.length > 0 && kept.length === 0) {
    return {
      ok: false,
      error: "locked_violation",
      message: "这些修改都碰到了已锁定的内容，行程没有改动。",
      usage,
      charged: true,
    };
  }
  return {
    ok: true,
    message: parsed.data.message,
    ops: kept,
    rejected,
    usage,
    charged: true,
  };
}
