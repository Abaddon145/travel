// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { generateItinerary } from "./generate";

const preference = {
  destination: "京都",
  startDate: "2026-11-10",
  endDate: "2026-11-10",
  travelers: 2,
  budget: "medium" as const,
  pace: "relaxed" as const,
  interests: ["寺庙"],
  notes: "",
};

const draft = {
  title: "京都一日",
  destination: "京都",
  startDate: "2026-11-10",
  endDate: "2026-11-10",
  summary: "走走",
  warnings: ["步行较多"],
  days: [
    {
      date: "2026-11-10",
      title: "东山",
      note: "",
      items: [
        {
          kind: "place",
          name: "清水寺",
          area: "东山",
          note: "",
          timeLabel: "9:30",
          checkIn: "",
          checkOut: "",
        },
      ],
    },
  ],
};

function completion(content: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      model: "deepseek-flash",
      choices: [
        {
          message: { content: typeof content === "string" ? content : JSON.stringify(content) },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 5,
        total_tokens: 8,
        prompt_cache_hit_tokens: 0,
        prompt_cache_miss_tokens: 3,
      },
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("生成与修复", () => {
  it("没有密钥时不发起请求", async () => {
    const fetchImpl = vi.fn();
    const result = await generateItinerary({
      preferences: preference,
      apiKey: "  ",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      fetchImpl,
    });
    expect(result).toMatchObject({ ok: false, error: "not_configured", charged: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("非法 JSON 会修复一次后通过", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(completion("   "))
      .mockResolvedValueOnce(completion(draft));
    const result = await generateItinerary({
      preferences: preference,
      apiKey: "sk-test-secret-value",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      fetchImpl,
      sleep: async () => undefined,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.days[0]?.items[0]?.timeLabel).toBe("09:30");
    expect(result.usage.attempts).toBe(2);
    expect(result.usage.totalTokens).toBe(16);
    const bodies = fetchImpl.mock.calls.map((call) => String(call[1]?.body));
    expect(bodies.join("")).not.toContain("sk-test-secret-value");
  });

  it("429 退避后成功，连续无效则停止", async () => {
    const sleep = vi.fn(async () => undefined);
    const retry = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(completion(draft));
    const recovered = await generateItinerary({
      preferences: preference,
      apiKey: "sk-test-secret-value",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      fetchImpl: retry,
      sleep,
    });
    expect(recovered.ok).toBe(true);
    expect(sleep).toHaveBeenCalledWith(400);

    const broken = vi.fn(async () => completion("{"));
    const failed = await generateItinerary({
      preferences: preference,
      apiKey: "sk-test-secret-value",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      fetchImpl: broken,
      sleep: async () => undefined,
    });
    expect(broken).toHaveBeenCalledTimes(3);
    expect(failed).toMatchObject({ ok: false, error: "invalid_output", charged: true });
  });
});
