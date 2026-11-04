import { render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { PlanScreen, type PlanForm, type PlanPhase } from "@/components/plan-screen";

const form: PlanForm = {
  destination: "",
  startDate: "",
  endDate: "",
  travelers: "2",
  budget: "medium",
  pace: "moderate",
  interests: "",
  notes: "",
  model: "deepseek-flash",
};

const draft = {
  title: "京都一日",
  destination: "京都",
  startDate: "2026-11-10",
  endDate: "2026-11-10",
  summary: "走走",
  warnings: ["步行较多"],
  days: [
    {
      date: "2026-11-10",
      title: "东山",
      note: "",
      items: [
        {
          kind: "place" as const,
          name: "清水寺",
          area: "东山",
          note: "",
          timeLabel: "09:30",
          checkIn: "",
          checkOut: "",
        },
      ],
    },
  ],
};

const usage = {
  model: "deepseek-flash" as const,
  promptTokens: 10,
  completionTokens: 20,
  totalTokens: 30,
  cacheHitTokens: 0,
  cacheMissTokens: 10,
  latencyMs: 5,
  attempts: 1,
};

describe("起草界面状态", () => {
  it("覆盖空表单、生成、重试、预览和失败", () => {
    const { rerender } = render(
      <MotionConfig reducedMotion="always">
        <PlanScreen
          form={form}
          phase={{ kind: "form", errors: { destination: "请填写目的地" } }}
          title=""
          onForm={vi.fn()}
          onTitle={vi.fn()}
          onSubmit={vi.fn()}
          onRetry={vi.fn()}
          onDiscard={vi.fn()}
          onSave={vi.fn()}
        />
      </MotionConfig>,
    );
    expect(screen.getByLabelText("目的地")).toBeInTheDocument();
    expect(screen.getByText("请填写目的地")).toBeInTheDocument();

    const show = (phase: PlanPhase) => {
      rerender(
        <MotionConfig reducedMotion="always">
          <PlanScreen
            form={form}
            phase={phase}
            title={draft.title}
            onForm={vi.fn()}
            onTitle={vi.fn()}
            onSubmit={vi.fn()}
            onRetry={vi.fn()}
            onDiscard={vi.fn()}
            onSave={vi.fn()}
          />
        </MotionConfig>,
      );
    };
    show({ kind: "generating" });
    expect(screen.getByText("正在生成")).toBeInTheDocument();
    show({ kind: "retrying" });
    expect(screen.getByText("正在重试")).toBeInTheDocument();
    show({ kind: "preview", draft, usage });
    expect(screen.getByText("清水寺")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存为行程" })).toBeEnabled();
    show({ kind: "rate_limited", message: "请求过于频繁。" });
    expect(screen.getByText("请求过于频繁。")).toBeInTheDocument();
    show({ kind: "quota_exceeded", message: "今日额度已用完。" });
    expect(screen.getByText("今日额度已用完。")).toBeInTheDocument();
    show({ kind: "network", message: "网络错误。" });
    expect(screen.getByText("网络错误。")).toBeInTheDocument();
    show({ kind: "unauthorized", message: "未授权。请先在「我的」里保存并通过私人密钥。" });
    expect(screen.getByText(/未授权/)).toBeInTheDocument();
    show({ kind: "invalid_output", message: "草稿没有通过校验。" });
    expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();
  });
});
