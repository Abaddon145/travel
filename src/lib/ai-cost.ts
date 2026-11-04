import type { AiModel } from "@shared/ai-schema";

/**
 * Off-peak USD per 1M tokens from DeepSeek Models & Pricing.
 * Peak hours are double. Cache-miss input is used when the split is unknown.
 */
const OFF_PEAK_PER_MILLION: Record<
  AiModel,
  { hit: number; miss: number; output: number }
> = {
  "deepseek-flash": { hit: 0.003, miss: 0.15, output: 0.6 },
  "deepseek-v4-pro": { hit: 0.022, miss: 0.66, output: 1.98 },
};

export type PricedUsage = {
  model: AiModel;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  latencyMs: number;
  attempts: number;
};

export function estimateUsd(usage: PricedUsage) {
  const price = OFF_PEAK_PER_MILLION[usage.model];
  const miss =
    usage.cacheHitTokens + usage.cacheMissTokens > 0
      ? usage.cacheMissTokens
      : usage.promptTokens;
  const hit = usage.cacheHitTokens;
  return (hit * price.hit + miss * price.miss + usage.completionTokens * price.output) / 1_000_000;
}

export function formatUsd(value: number) {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}
