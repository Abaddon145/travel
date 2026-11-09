import { describe, expect, it } from "vitest";
import {
  MAX_MINOR,
  budgetReport,
  explainVariance,
  formatMinor,
  minorToInput,
  parseMinor,
  type LedgerAmounts,
} from "@/domain/money";

function line(
  partial: Partial<LedgerAmounts> & Pick<LedgerAmounts, "plannedMinor">,
): LedgerAmounts {
  return {
    currency: "CNY",
    category: "food",
    date: "2026-11-12",
    actualMinor: null,
    ...partial,
  };
}

describe("金额解析", () => {
  it("用整数分处理小数，不走浮点乘法", () => {
    expect(parseMinor("0.10", "CNY")).toEqual({ ok: true, minor: 10 });
    expect(parseMinor("0.20", "CNY")).toEqual({ ok: true, minor: 20 });
    expect(parseMinor("19.99", "CNY")).toEqual({ ok: true, minor: 1999 });
    expect(parseMinor("0.01", "CNY")).toEqual({ ok: true, minor: 1 });
    expect(parseMinor("10", "CNY")).toEqual({ ok: true, minor: 1000 });
    expect(parseMinor("  ¥1,200.50 ", "CNY")).toEqual({ ok: true, minor: 120050 });
    const a = parseMinor("0.10", "CNY");
    const b = parseMinor("0.20", "CNY");
    if (!a.ok || !b.ok) throw new Error("解析失败");
    const report = budgetReport([
      line({ plannedMinor: a.minor, actualMinor: a.minor, category: "food" }),
      line({ plannedMinor: b.minor, actualMinor: b.minor, category: "food" }),
    ]);
    expect(report[0]?.total.plannedMinor).toBe(30);
    expect(formatMinor(30, "CNY")).toBe("¥0.30");
  });

  it("拒绝负数、多余小数、前导零和超出上限", () => {
    expect(parseMinor("", "CNY").ok).toBe(false);
    expect(parseMinor("-1", "CNY")).toMatchObject({ ok: false, message: "金额不能为负" });
    expect(parseMinor("0.001", "CNY")).toMatchObject({ ok: false, message: "最多保留两位小数" });
    expect(parseMinor("10.999", "CNY").ok).toBe(false);
    expect(parseMinor("01.50", "CNY").ok).toBe(false);
    expect(parseMinor("10.", "CNY").ok).toBe(false);
    expect(parseMinor("+10", "CNY").ok).toBe(false);
    expect(parseMinor("1000000000.00", "CNY")).toEqual({ ok: true, minor: MAX_MINOR });
    expect(parseMinor("1000000000.01", "CNY")).toMatchObject({ ok: false, message: "金额过大" });
    expect(parseMinor("999999999999999.99", "CNY")).toMatchObject({ ok: false, message: "金额过大" });
  });

  it("日元和韩元不接受小数", () => {
    expect(parseMinor("1200", "JPY")).toEqual({ ok: true, minor: 1200 });
    expect(parseMinor("0", "JPY")).toEqual({ ok: true, minor: 0 });
    expect(parseMinor("1200.5", "JPY")).toMatchObject({ ok: false, message: "这个币种不使用小数" });
    expect(parseMinor("₩3,000", "KRW")).toEqual({ ok: true, minor: 3000 });
    expect(formatMinor(1200, "JPY")).toBe("JP¥1,200");
    expect(minorToInput(1999, "CNY")).toBe("19.99");
    expect(minorToInput(null, "CNY")).toBe("");
  });
});

describe("预算合计", () => {
  const kyoto: LedgerAmounts[] = [
    line({
      category: "lodging",
      date: "2026-11-12",
      plannedMinor: 320000,
      actualMinor: 286000,
    }),
    line({
      category: "transport",
      date: "2026-11-12",
      plannedMinor: 86000,
      actualMinor: 73400,
    }),
    line({
      category: "food",
      date: "2026-11-13",
      plannedMinor: 18000,
      actualMinor: 16400,
    }),
    line({ category: "ticket", date: "2026-11-13", plannedMinor: 8000, actualMinor: null }),
    line({ category: "food", date: "2026-11-14", plannedMinor: 4500, actualMinor: 4500 }),
    line({
      category: "shopping",
      date: "2026-11-15",
      plannedMinor: 20000,
      actualMinor: 12600,
    }),
  ];

  it("整趟合计区分预计、已记实际和未记", () => {
    const report = budgetReport(kyoto);
    expect(report).toHaveLength(1);
    expect(report[0]?.currency).toBe("CNY");
    expect(report[0]?.total).toMatchObject({
      plannedMinor: 456500,
      actualMinor: 392900,
      varianceMinor: -63600,
      recordedPlannedMinor: 448500,
      recordedActualMinor: 392900,
      recordedVarianceMinor: -55600,
      openPlannedMinor: 8000,
      entryCount: 6,
      openCount: 1,
    });
    expect(explainVariance(report[0]!.total, "CNY")).toBe(
      "少 ¥636.00 · 已记少 ¥556.00 · 未记 ¥80.00",
    );
    expect(formatMinor(456500, "CNY")).toBe("¥4,565.00");
    expect(formatMinor(392900, "CNY")).toBe("¥3,929.00");
  });

  it("按类别汇总，并略过没有条目的类别", () => {
    const categories = budgetReport(kyoto)[0]?.categories ?? [];
    expect(categories.map((item) => item.category)).toEqual([
      "lodging",
      "transport",
      "food",
      "ticket",
      "shopping",
    ]);
    expect(categories.find((item) => item.category === "food")).toMatchObject({
      plannedMinor: 22500,
      actualMinor: 20900,
      recordedVarianceMinor: -1600,
    });
    expect(categories.find((item) => item.category === "ticket")).toMatchObject({
      plannedMinor: 8000,
      actualMinor: 0,
      openCount: 1,
    });
  });

  it("按天汇总，未指定日期排在最后", () => {
    const days = budgetReport([
      ...kyoto,
      line({ category: "other", date: "", plannedMinor: 100, actualMinor: 100 }),
    ])[0]?.days;
    expect(days?.map((item) => item.date)).toEqual([
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "",
    ]);
    expect(days?.[0]).toMatchObject({ plannedMinor: 406000, actualMinor: 359400 });
    expect(days?.[1]).toMatchObject({ plannedMinor: 26000, actualMinor: 16400, openCount: 1 });
  });

  it("不同币种不加在一起", () => {
    const reports = budgetReport([
      line({ plannedMinor: 100, actualMinor: 80 }),
      line({ currency: "JPY", plannedMinor: 500, actualMinor: 500 }),
      line({ currency: "USD", plannedMinor: 200, actualMinor: null }),
    ]);
    expect(reports.map((item) => item.currency)).toEqual(["CNY", "JPY", "USD"]);
    expect(reports[0]?.total.plannedMinor).toBe(100);
    expect(reports[1]?.total.plannedMinor).toBe(500);
    expect(reports[2]?.total.actualMinor).toBe(0);
    expect(reports[2]?.total.openPlannedMinor).toBe(200);
  });

  it("空账、全零、只记实际、实际为零都有稳定结果", () => {
    expect(budgetReport([])).toEqual([]);
    const zeros = budgetReport([line({ plannedMinor: 0, actualMinor: 0 })]);
    expect(zeros[0]?.total).toMatchObject({
      plannedMinor: 0,
      actualMinor: 0,
      varianceMinor: 0,
      openCount: 0,
    });
    expect(explainVariance(zeros[0]!.total, "CNY")).toBe("与预计一致");

    const actualOnly = budgetReport([line({ plannedMinor: 0, actualMinor: 5000 })]);
    expect(actualOnly[0]?.total.varianceMinor).toBe(5000);
    expect(explainVariance(actualOnly[0]!.total, "CNY")).toBe("超出 ¥50.00");

    const unpaid = budgetReport([line({ plannedMinor: 8000, actualMinor: null })]);
    expect(unpaid[0]?.total.actualMinor).toBe(0);
    expect(explainVariance(unpaid[0]!.total, "CNY")).toBe("还没有实际花费 · 未记 ¥80.00");

    const recordedZero = budgetReport([line({ plannedMinor: 1500, actualMinor: 0 })]);
    expect(recordedZero[0]?.total).toMatchObject({
      actualMinor: 0,
      openCount: 0,
      recordedVarianceMinor: -1500,
    });
    expect(explainVariance(recordedZero[0]!.total, "CNY")).toBe("少 ¥15.00");
  });

  it("负数和超出安全整数的合计直接失败", () => {
    expect(() => budgetReport([line({ plannedMinor: -1, actualMinor: 0 })])).toThrow(RangeError);
    expect(() =>
      budgetReport([
        line({ plannedMinor: Number.MAX_SAFE_INTEGER, actualMinor: null }),
        line({ plannedMinor: 1, actualMinor: null }),
      ]),
    ).toThrow(/超出可精确表示的范围/);
  });
});
