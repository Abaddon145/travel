import { motion } from "motion/react";
import { formatMinor } from "@/domain/money";
import type { CurrencyCode } from "@/domain/types";

const ease = [0.22, 1, 0.36, 1] as const;

export function MoneyFigure({
  minor,
  currency,
  quiet,
}: {
  minor: number;
  currency: CurrencyCode;
  quiet: boolean;
}) {
  const text = formatMinor(minor, currency);
  return (
    <motion.span
      key={`${currency}:${minor}`}
      data-final={text}
      className="tabular-nums tracking-tight"
      initial={quiet ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: quiet ? 0 : 0.2, ease }}
    >
      {text}
    </motion.span>
  );
}
