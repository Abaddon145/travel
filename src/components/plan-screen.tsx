import { motion, useReducedMotion } from "motion/react";
import { TripTimeline } from "@/components/trip-timeline";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/text-field";
import type { AiFailure } from "@/lib/ai-client";
import { estimateUsd, formatUsd, type PricedUsage } from "@/lib/ai-cost";
import type { TravelDraft } from "@shared/ai-schema";
import type { DayView } from "@/domain/types";

export type PlanForm = {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: string;
  budget: "low" | "medium" | "high";
  pace: "relaxed" | "moderate" | "packed";
  interests: string;
  notes: string;
  model: "deepseek-flash" | "deepseek-v4-pro";
};

export type PlanPhase =
  | { kind: "form"; errors: Record<string, string> }
  | { kind: "generating" }
  | { kind: "retrying" }
  | { kind: "preview"; draft: TravelDraft; usage: PricedUsage }
  | { kind: "saving" }
  | { kind: AiFailure; message: string };

const budgets = [
  { id: "low", label: "节俭" },
  { id: "medium", label: "适中" },
  { id: "high", label: "宽裕" },
] as const;

const paces = [
  { id: "relaxed", label: "从容" },
  { id: "moderate", label: "适中" },
  { id: "packed", label: "紧凑" },
] as const;

const models = [
  { id: "deepseek-flash", label: "快速" },
  { id: "deepseek-v4-pro", label: "细致" },
] as const;

const failureCopy: Record<AiFailure, string> = {
  unauthorized: "未授权。请先在「我的」里保存并通过私人密钥。",
  not_configured: "模型密钥还没配置。",
  validation_error: "请修正出行偏好。",
  invalid_output: "草稿没有通过校验。",
  rate_limited: "请求过于频繁。",
  quota_exceeded: "今日额度已用完。",
  timeout: "生成超时。",
  network: "网络错误。",
  upstream_auth: "模型服务没有接受密钥。",
  upstream_balance: "模型账户余额不足。",
  upstream_unavailable: "模型服务暂时不可用。",
  upstream_rejected: "模型服务拒绝了这次请求。",
};

function toTimeline(draft: TravelDraft): DayView[] {
  return draft.days.map((day, index) => ({
    id: day.date,
    date: day.date,
    title: day.title,
    note: day.note,
    order: index,
    items: day.items.map((item, itemIndex) => ({
      id: `${day.date}-${itemIndex}`,
      kind: item.kind,
      refId: item.name,
      name: item.name,
      area: item.area,
      note: item.note,
      timeLabel: item.timeLabel,
      locked: false,
      order: itemIndex,
      checkIn: item.checkIn,
      checkOut: item.checkOut,
    })),
  }));
}

function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <Button
            key={option.id}
            type="button"
            className="h-11"
            variant={value === option.id ? "default" : "outline"}
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function PlanScreen({
  form,
  phase,
  title,
  onForm,
  onTitle,
  onSubmit,
  onRetry,
  onDiscard,
  onSave,
}: {
  form: PlanForm;
  phase: PlanPhase;
  title: string;
  onForm: (patch: Partial<PlanForm>) => void;
  onTitle: (value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const reduce = useReducedMotion();
  const errors = phase.kind === "form" ? phase.errors : {};
  return (
    <motion.div
      className="flex flex-col gap-6"
      initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {phase.kind === "form" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <p className="text-sm leading-6 text-muted-foreground">
            写下偏好。生成结果先给你看，确认后才写入这台设备。
          </p>
          <TextField
            id="plan-destination"
            label="目的地"
            value={form.destination}
            error={errors.destination}
            onChange={(value) => onForm({ destination: value })}
          />
          <TextField
            id="plan-start"
            label="开始日期"
            type="date"
            value={form.startDate}
            error={errors.startDate}
            onChange={(value) => onForm({ startDate: value })}
          />
          <TextField
            id="plan-end"
            label="结束日期"
            type="date"
            value={form.endDate}
            error={errors.endDate}
            onChange={(value) => onForm({ endDate: value })}
          />
          <TextField
            id="plan-travelers"
            label="人数"
            type="number"
            value={form.travelers}
            error={errors.travelers}
            onChange={(value) => onForm({ travelers: value })}
          />
          <Choices
            label="预算"
            value={form.budget}
            options={budgets}
            onChange={(budget) => onForm({ budget })}
          />
          <Choices
            label="节奏"
            value={form.pace}
            options={paces}
            onChange={(pace) => onForm({ pace })}
          />
          <TextField
            id="plan-interests"
            label="兴趣"
            value={form.interests}
            error={errors.interests}
            onChange={(value) => onForm({ interests: value })}
          />
          <TextField
            id="plan-notes"
            label="备注"
            value={form.notes}
            error={errors.notes}
            multiline
            onChange={(value) => onForm({ notes: value })}
          />
          <Choices
            label="模型"
            value={form.model}
            options={models}
            onChange={(model) => onForm({ model })}
          />
          <p className="text-sm leading-6 text-muted-foreground">
            快速使用 deepseek-flash。细致使用 deepseek-v4-pro，费用更高。
          </p>
          <Button type="submit" className="h-11">
            生成草稿
          </Button>
        </form>
      ) : null}

      {phase.kind === "generating" || phase.kind === "retrying" ? (
        <div className="flex items-center gap-3" role="status" aria-live="polite">
          <Spinner />
          <p className="text-sm">{phase.kind === "retrying" ? "正在重试" : "正在生成"}</p>
        </div>
      ) : null}

      {phase.kind === "preview" ? (
        <div className="flex flex-col gap-4">
          <TextField id="plan-title" label="标题" value={title} onChange={onTitle} />
          {phase.draft.warnings.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {phase.draft.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {phase.usage.attempts} 次尝试，{phase.usage.totalTokens} token，估算{" "}
            {formatUsd(estimateUsd(phase.usage))}。
          </p>
          <TripTimeline days={toTimeline({ ...phase.draft, title })} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-11" onClick={onSave}>
              保存为行程
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onRetry}>
              重新生成
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={onDiscard}>
              放弃
            </Button>
          </div>
        </div>
      ) : null}

      {phase.kind === "saving" ? (
        <p role="status" className="text-sm">
          正在保存
        </p>
      ) : null}

      {phase.kind !== "form" &&
      phase.kind !== "generating" &&
      phase.kind !== "retrying" &&
      phase.kind !== "preview" &&
      phase.kind !== "saving" ? (
        <div className="flex flex-col gap-4" role="status">
          <p className="text-sm leading-6">{phase.message || failureCopy[phase.kind]}</p>
          <Button type="button" variant="outline" className="h-11" onClick={onRetry}>
            重试
          </Button>
        </div>
      ) : null}
    </motion.div>
  );
}

