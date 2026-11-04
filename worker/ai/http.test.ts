// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { shanghaiDay } from "../../shared/ai-schema";
import { handleAiRequest, type UsageNamespace } from "./http";
import {
  addTokens,
  releaseRequest,
  reserveRequest,
  summarize,
  type Ledger,
} from "./quota";

function ledgerNamespace(initial: Ledger = {}): UsageNamespace & { read: () => Ledger } {
  let ledger = initial;
  const stub = {
    async reserve(input: { today: string; requestCap: number; tokenCap: number }) {
      const result = reserveRequest(ledger, input.today, {
        requests: input.requestCap,
        tokens: input.tokenCap,
      });
      ledger = result.ledger;
      return { ok: result.ok, ...result.summary };
    },
    async commit(input: { today: string; tokens: number }) {
      ledger = addTokens(ledger, input.today, input.tokens);
    },
    async release(input: { today: string }) {
      ledger = releaseRequest(ledger, input.today);
    },
    async summary(input: { today: string }) {
      return summarize(ledger, input.today);
    },
  };
  return {
    idFromName: () => "owner",
    get: () => stub,
    read: () => ledger,
  };
}

const preference = {
  destination: "京都",
  startDate: "2026-11-10",
  endDate: "2026-11-10",
  travelers: 2,
  budget: "medium",
  pace: "relaxed",
  interests: ["寺庙"],
  notes: "",
  model: "deepseek-v4-pro",
};

describe("AI 路由", () => {
  it("缺少密钥时失败关闭且不调用模型", async () => {
    const fetchImpl = vi.fn();
    const response = await handleAiRequest(
      new Request("https://lvxu.test/api/ai/itinerary", {
        method: "POST",
        body: JSON.stringify(preference),
      }),
      {
        DEEPSEEK_API_KEY: "",
        AI_USAGE: ledgerNamespace(),
      },
      fetchImpl,
    );
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({ error: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("额度用尽时返回 quota_exceeded", async () => {
    const fetchImpl = vi.fn();
    const response = await handleAiRequest(
      new Request("https://lvxu.test/api/paid/draft", {
        method: "POST",
        body: JSON.stringify(preference),
      }),
      {
        DEEPSEEK_API_KEY: "sk-test-secret-value",
        AI_DAILY_REQUEST_CAP: "30",
        AI_USAGE: ledgerNamespace({
          [shanghaiDay()]: { requests: 30, tokens: 0 },
        }),
      },
      fetchImpl,
    );
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: "quota_exceeded" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
