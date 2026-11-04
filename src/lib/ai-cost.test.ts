import { describe, expect, it } from "vitest";
import { estimateUsd, formatUsd } from "@/lib/ai-cost";

const base = {
  promptTokens: 1_000_000,
  completionTokens: 1_000_000,
  totalTokens: 2_000_000,
  cacheHitTokens: 0,
  cacheMissTokens: 1_000_000,
  latencyMs: 10,
  attempts: 1,
};

describe("费用估算", () => {
  it("按官方闲时未命中价格估算", () => {
    expect(
      estimateUsd({
        ...base,
        model: "deepseek-flash",
      }),
    ).toBeCloseTo(0.75);
    expect(
      estimateUsd({
        ...base,
        model: "deepseek-v4-pro",
      }),
    ).toBeCloseTo(2.64);
    expect(formatUsd(0.75)).toBe("$0.75");
  });
});
