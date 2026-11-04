// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addTokens,
  parseCap,
  pruneLedger,
  releaseRequest,
  reserveRequest,
  summarize,
} from "./quota";

describe("每日额度", () => {
  it("第 30 次可以占用，第 31 次拒绝", () => {
    let ledger = {};
    for (let count = 0; count < 30; count += 1) {
      const result = reserveRequest(ledger, "2026-11-04", { requests: 30, tokens: 1000 });
      expect(result.ok).toBe(true);
      ledger = result.ledger;
    }
    const blocked = reserveRequest(ledger, "2026-11-04", { requests: 30, tokens: 1000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.summary.today.requests).toBe(30);
  });

  it("token 达到上限后不再占用", () => {
    const ledger = { "2026-11-04": { requests: 1, tokens: 100_000 } };
    const result = reserveRequest(ledger, "2026-11-04", {
      requests: 30,
      tokens: 100_000,
    });
    expect(result.ok).toBe(false);
  });

  it("失败退回次数，成功累加 token，并汇总本月", () => {
    const reserved = reserveRequest({}, "2026-11-04", { requests: 30, tokens: 100 });
    expect(reserved.ok).toBe(true);
    const released = releaseRequest(reserved.ledger, "2026-11-04");
    expect(released["2026-11-04"]?.requests).toBe(0);
    const again = reserveRequest(released, "2026-11-04", { requests: 30, tokens: 100 });
    const withTokens = addTokens(again.ledger, "2026-11-04", 40);
    const older = { ...withTokens, "2026-11-02": { requests: 2, tokens: 10 } };
    expect(summarize(older, "2026-11-04").month).toEqual({ requests: 3, tokens: 50 });
    expect(summarize(older, "2026-11-04").today.tokens).toBe(40);
  });

  it("丢掉过旧的日期，并拒绝非法上限", () => {
    const pruned = pruneLedger(
      {
        "2026-09-01": { requests: 1, tokens: 1 },
        "2026-11-04": { requests: 2, tokens: 3 },
      },
      "2026-11-04",
    );
    expect(pruned["2026-09-01"]).toBeUndefined();
    expect(pruned["2026-11-04"]?.requests).toBe(2);
    expect(parseCap("30", 8)).toBe(30);
    expect(parseCap("0", 8)).toBe(8);
    expect(parseCap("nope", 8)).toBe(8);
  });
});
