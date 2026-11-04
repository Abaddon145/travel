export type DayUsage = { requests: number; tokens: number };
export type Ledger = Record<string, DayUsage>;

export const DEFAULT_REQUEST_CAP = 30;
export const DEFAULT_TOKEN_CAP = 100_000;

export function parseCap(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1_000_000) return fallback;
  return parsed;
}

function emptyUsage(): DayUsage {
  return { requests: 0, tokens: 0 };
}

function shiftDay(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function pruneLedger(ledger: Ledger, today: string) {
  const cutoff = shiftDay(today, -45);
  const next: Ledger = {};
  for (const [day, usage] of Object.entries(ledger)) {
    if (day >= cutoff && day <= today) next[day] = usage;
  }
  return next;
}

export function summarize(ledger: Ledger, today: string) {
  const month = today.slice(0, 7);
  let requests = 0;
  let tokens = 0;
  for (const [day, usage] of Object.entries(ledger)) {
    if (!day.startsWith(month)) continue;
    requests += usage.requests;
    tokens += usage.tokens;
  }
  return {
    today: ledger[today] ?? emptyUsage(),
    month: { requests, tokens },
  };
}

export function reserveRequest(
  ledger: Ledger,
  today: string,
  caps: { requests: number; tokens: number },
) {
  const pruned = pruneLedger(ledger, today);
  const current = pruned[today] ?? emptyUsage();
  if (current.requests >= caps.requests || current.tokens >= caps.tokens) {
    return { ok: false as const, ledger: pruned, summary: summarize(pruned, today) };
  }
  const next: Ledger = {
    ...pruned,
    [today]: { requests: current.requests + 1, tokens: current.tokens },
  };
  return { ok: true as const, ledger: next, summary: summarize(next, today) };
}

export function addTokens(ledger: Ledger, today: string, tokens: number) {
  const current = ledger[today] ?? emptyUsage();
  return {
    ...ledger,
    [today]: {
      requests: current.requests,
      tokens: current.tokens + Math.max(0, Math.floor(tokens)),
    },
  };
}

export function releaseRequest(ledger: Ledger, today: string) {
  const current = ledger[today] ?? emptyUsage();
  return {
    ...ledger,
    [today]: { requests: Math.max(0, current.requests - 1), tokens: current.tokens },
  };
}
