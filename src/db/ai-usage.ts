import { z } from "zod";
import type { TravelDatabase } from "@/db/database";
import { ValidationError } from "@/db/errors";
import { shanghaiDay } from "@shared/ai-schema";
import { estimateUsd, type PricedUsage } from "@/lib/ai-cost";

export type AiUsageEntry = PricedUsage & {
  id: string;
  createdAt: number;
  destination: string;
};

const entrySchema = z.object({
  id: z.string().min(1),
  createdAt: z.number(),
  destination: z.string().max(40),
  model: z.enum(["deepseek-flash", "deepseek-v4-pro"]),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  cacheHitTokens: z.number().int().nonnegative(),
  cacheMissTokens: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  attempts: z.number().int().positive(),
});

export async function recordAiUsage(db: TravelDatabase, input: unknown) {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error);
  await db.aiUsage.add(parsed.data);
}

export async function readAiUsageStats(db: TravelDatabase, now = Date.now()) {
  const rows = (await db.aiUsage.toArray()) as AiUsageEntry[];
  const today = shanghaiDay(now);
  const month = today.slice(0, 7);
  const totals = {
    todayCalls: 0,
    todayTokens: 0,
    monthCalls: 0,
    monthTokens: 0,
    monthUsd: 0,
  };
  for (const row of rows) {
    const day = shanghaiDay(row.createdAt);
    if (!day.startsWith(month)) continue;
    totals.monthCalls += 1;
    totals.monthTokens += row.totalTokens;
    totals.monthUsd += estimateUsd(row);
    if (day === today) {
      totals.todayCalls += 1;
      totals.todayTokens += row.totalTokens;
    }
  }
  return totals;
}
