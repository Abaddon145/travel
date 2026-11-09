import { motion } from "motion/react";
import { categoryLabel, formatMinor, type CategorySlice } from "@/domain/money";
import type { CurrencyCode } from "@/domain/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

function Bar({
  ratio,
  quiet,
  tone,
}: {
  ratio: number;
  quiet: boolean;
  tone: "planned" | "actual";
}) {
  const width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <motion.div
        className={cn("h-full origin-left", tone === "actual" ? "bg-primary" : "bg-chart-2")}
        initial={quiet ? false : { transform: "scaleX(0)" }}
        animate={{ transform: "scaleX(1)" }}
        style={{ width }}
        transition={{ duration: quiet ? 0 : 0.4, ease }}
      />
    </div>
  );
}

export function BudgetChart({
  rows,
  currency,
  quiet,
}: {
  rows: CategorySlice[];
  currency: CurrencyCode;
  quiet: boolean;
}) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.plannedMinor, row.actualMinor]));
  return (
    <section className="flex flex-col gap-5" aria-label="分类统计">
      {rows.map((row) => {
        const actualText =
          row.openCount === row.entryCount ? "未记" : formatMinor(row.actualMinor, currency);
        return (
          <div key={row.category} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{categoryLabel[row.category]}</span>
              <span className="text-muted-foreground tabular-nums">
                预计 {formatMinor(row.plannedMinor, currency)}
              </span>
            </div>
            <Bar ratio={row.plannedMinor / max} quiet={quiet} tone="planned" />
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-primary">实际</span>
              <span className="tabular-nums text-primary">{actualText}</span>
            </div>
            <Bar ratio={row.actualMinor / max} quiet={quiet} tone="actual" />
          </div>
        );
      })}
    </section>
  );
}
