import type { CurrencyCode, SpendCategory } from "@/domain/types";

export const currencyCodes = ["CNY", "USD", "JPY", "EUR", "HKD", "TWD", "KRW"] as const;

export const categoryOrder = [
  "lodging",
  "transport",
  "food",
  "ticket",
  "shopping",
  "other",
] as const satisfies readonly SpendCategory[];

export const categoryLabel: Record<SpendCategory, string> = {
  lodging: "住宿",
  transport: "交通",
  food: "餐饮",
  ticket: "门票",
  shopping: "购物",
  other: "其他",
};

export const currencyLabel: Record<CurrencyCode, string> = {
  CNY: "人民币",
  USD: "美元",
  JPY: "日元",
  EUR: "欧元",
  HKD: "港币",
  TWD: "新台币",
  KRW: "韩元",
};

/** One billion yuan, in minor units. Sums of capped lines stay inside Number.MAX_SAFE_INTEGER. */
export const MAX_MINOR = 100_000_000_000;

const symbols: Record<CurrencyCode, string> = {
  CNY: "¥",
  USD: "$",
  JPY: "JP¥",
  EUR: "€",
  HKD: "HK$",
  TWD: "NT$",
  KRW: "₩",
};

export type MoneyBucket = {
  plannedMinor: number;
  actualMinor: number;
  varianceMinor: number;
  recordedPlannedMinor: number;
  recordedActualMinor: number;
  recordedVarianceMinor: number;
  openPlannedMinor: number;
  entryCount: number;
  openCount: number;
};

export type CategorySlice = MoneyBucket & { category: SpendCategory };
export type DaySlice = MoneyBucket & { date: string };

export type CurrencyReport = {
  currency: CurrencyCode;
  total: MoneyBucket;
  categories: CategorySlice[];
  days: DaySlice[];
};

export type LedgerAmounts = {
  currency: CurrencyCode;
  category: SpendCategory;
  date: string;
  plannedMinor: number;
  actualMinor: number | null;
};

export type MinorParse = { ok: true; minor: number } | { ok: false; message: string };

export function currencyExponent(currency: CurrencyCode): 0 | 2 {
  return currency === "JPY" || currency === "KRW" ? 0 : 2;
}

export function currencySymbol(currency: CurrencyCode) {
  return symbols[currency];
}

function groupDigits(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatMinor(minor: number, currency: CurrencyCode) {
  const sign = minor < 0 ? "-" : "";
  const abs = minor < 0 ? -minor : minor;
  const symbol = symbols[currency];
  if (currencyExponent(currency) === 0) {
    return `${sign}${symbol}${groupDigits(String(abs))}`;
  }
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${symbol}${groupDigits(String(whole))}.${frac}`;
}

export function minorToInput(minor: number | null, currency: CurrencyCode) {
  if (minor === null) return "";
  if (currencyExponent(currency) === 0) return String(minor);
  const whole = Math.floor(minor / 100);
  const frac = String(minor % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}

function fail(message: string): MinorParse {
  return { ok: false, message };
}

export function parseMinor(input: string, currency: CurrencyCode): MinorParse {
  const exponent = currencyExponent(currency);
  let text = input.trim().replace(/\s+/g, "");
  if (!text) return fail("请填写金额");
  text = text.replace(/^(CNY|USD|JPY|EUR|HKD|TWD|KRW|HK\$|NT\$|JP¥|JP￥)/i, "");
  text = text.replace(/[¥￥$€₩元円,]/g, "");
  if (text.startsWith("-")) return fail("金额不能为负");
  if (!/^\d+(\.\d+)?$/.test(text)) return fail("请填写金额");
  const [whole, frac = ""] = text.split(".");
  if (whole.length > 1 && whole.startsWith("0")) return fail("请填写金额");
  if (frac.length > exponent) {
    return fail(exponent === 0 ? "这个币种不使用小数" : "最多保留两位小数");
  }
  const digits = `${whole}${frac.padEnd(exponent, "0")}`.replace(/^0+(?=\d)/, "");
  if (digits.length > 15) return fail("金额过大");
  const minor = Number(digits);
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR) return fail("金额过大");
  return { ok: true, minor };
}

function assertMinor(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("金额不是可合计的整数");
  }
}

function add(left: number, right: number) {
  const next = left + right;
  if (!Number.isSafeInteger(next)) {
    throw new RangeError("金额合计超出可精确表示的范围");
  }
  return next;
}

function emptyBucket(): MoneyBucket {
  return {
    plannedMinor: 0,
    actualMinor: 0,
    varianceMinor: 0,
    recordedPlannedMinor: 0,
    recordedActualMinor: 0,
    recordedVarianceMinor: 0,
    openPlannedMinor: 0,
    entryCount: 0,
    openCount: 0,
  };
}

function finish(bucket: MoneyBucket): MoneyBucket {
  const varianceMinor = bucket.actualMinor - bucket.plannedMinor;
  const recordedVarianceMinor = bucket.recordedActualMinor - bucket.recordedPlannedMinor;
  if (!Number.isSafeInteger(varianceMinor) || !Number.isSafeInteger(recordedVarianceMinor)) {
    throw new RangeError("金额合计超出可精确表示的范围");
  }
  return { ...bucket, varianceMinor, recordedVarianceMinor };
}

function absorb(bucket: MoneyBucket, entry: LedgerAmounts) {
  assertMinor(entry.plannedMinor);
  if (entry.actualMinor !== null) assertMinor(entry.actualMinor);
  const next = { ...bucket, entryCount: bucket.entryCount + 1 };
  next.plannedMinor = add(next.plannedMinor, entry.plannedMinor);
  if (entry.actualMinor === null) {
    next.openCount += 1;
    next.openPlannedMinor = add(next.openPlannedMinor, entry.plannedMinor);
    return next;
  }
  next.actualMinor = add(next.actualMinor, entry.actualMinor);
  next.recordedPlannedMinor = add(next.recordedPlannedMinor, entry.plannedMinor);
  next.recordedActualMinor = add(next.recordedActualMinor, entry.actualMinor);
  return next;
}

export function isOverBudget(plannedMinor: number, actualMinor: number | null) {
  return actualMinor !== null && actualMinor > plannedMinor;
}

export function explainVariance(bucket: MoneyBucket, currency: CurrencyCode) {
  if (bucket.entryCount === 0) return "还没有金额";
  if (bucket.openCount === bucket.entryCount) {
    return `还没有实际花费 · 未记 ${formatMinor(bucket.openPlannedMinor, currency)}`;
  }
  const gap = bucket.varianceMinor < 0 ? -bucket.varianceMinor : bucket.varianceMinor;
  const headline =
    bucket.varianceMinor === 0
      ? "与预计一致"
      : bucket.varianceMinor < 0
        ? `少 ${formatMinor(gap, currency)}`
        : `超出 ${formatMinor(gap, currency)}`;
  if (bucket.openCount === 0) return headline;
  const recorded =
    bucket.recordedVarianceMinor === 0
      ? "已记与预计一致"
      : bucket.recordedVarianceMinor < 0
        ? `已记少 ${formatMinor(-bucket.recordedVarianceMinor, currency)}`
        : `已记超出 ${formatMinor(bucket.recordedVarianceMinor, currency)}`;
  return `${headline} · ${recorded} · 未记 ${formatMinor(bucket.openPlannedMinor, currency)}`;
}

export function budgetReport(entries: LedgerAmounts[]): CurrencyReport[] {
  const byCurrency = new Map<CurrencyCode, LedgerAmounts[]>();
  for (const entry of entries) {
    const list = byCurrency.get(entry.currency);
    if (list) list.push(entry);
    else byCurrency.set(entry.currency, [entry]);
  }

  const currencies = [...byCurrency.keys()].sort((a, b) => {
    if (a === "CNY") return -1;
    if (b === "CNY") return 1;
    return a.localeCompare(b);
  });

  return currencies.map((currency) => {
    const rows = byCurrency.get(currency) ?? [];
    let total = emptyBucket();
    const categories = new Map<SpendCategory, MoneyBucket>();
    const days = new Map<string, MoneyBucket>();
    for (const entry of rows) {
      total = absorb(total, entry);
      categories.set(entry.category, absorb(categories.get(entry.category) ?? emptyBucket(), entry));
      days.set(entry.date, absorb(days.get(entry.date) ?? emptyBucket(), entry));
    }
    const categorySlices = categoryOrder
      .filter((category) => categories.has(category))
      .map((category) => ({ category, ...finish(categories.get(category) ?? emptyBucket()) }));
    const daySlices = [...days.keys()]
      .sort((a, b) => {
        if (a === b) return 0;
        if (a === "") return 1;
        if (b === "") return -1;
        return a.localeCompare(b);
      })
      .map((date) => ({ date, ...finish(days.get(date) ?? emptyBucket()) }));
    return { currency, total: finish(total), categories: categorySlices, days: daySlices };
  });
}

export function preferredCurrency(reports: CurrencyReport[]): CurrencyCode {
  if (reports.some((report) => report.currency === "CNY")) return "CNY";
  return reports[0]?.currency ?? "CNY";
}
