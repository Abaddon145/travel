import { animate } from "motion/react";
import { useEffect, useRef } from "react";
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
  const node = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const seenCurrency = useRef(currency);
  const finalText = formatMinor(minor, currency);

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    const currencyChanged = seenCurrency.current !== currency;
    seenCurrency.current = currency;
    if (quiet || currencyChanged) {
      from.current = minor;
      el.textContent = finalText;
      return;
    }
    const controls = animate(from.current, minor, {
      duration: 0.45,
      ease,
      onUpdate: (latest) => {
        const next = Math.round(latest);
        from.current = next;
        el.textContent = formatMinor(next, currency);
      },
    });
    return () => controls.stop();
  }, [minor, currency, quiet, finalText]);

  return (
    <span
      ref={node}
      data-final={finalText}
      className="tabular-nums tracking-tight"
    >
      {quiet ? finalText : formatMinor(0, currency)}
    </span>
  );
}
