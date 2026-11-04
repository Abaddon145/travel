// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { completeJson, sanitizeSecrets } from "./deepseek";

const key = "sk-test-secret-value";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("DeepSeek 适配器", () => {
  it("用 JSON 模式调用，并读出用量", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, {
        model: "deepseek-flash",
        choices: [{ message: { content: "{\"ok\":true}" }, finish_reason: "stop" }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 4,
          total_tokens: 14,
          prompt_cache_hit_tokens: 2,
          prompt_cache_miss_tokens: 8,
        },
      }),
    );
    const result = await completeJson({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      apiKey: key,
      baseUrl: "https://api.deepseek.com/",
      model: "deepseek-flash",
      messages: [{ role: "user", content: "请输出 json" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usage.totalTokens).toBe(14);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${key}`);
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("deepseek-flash");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.max_tokens).toBe(8192);
  });

  it("错误响应不带出密钥", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: { message: key } }));
    const result = await completeJson({
      fetchImpl,
      apiKey: key,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
      messages: [{ role: "user", content: "json" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("upstream_auth");
    expect(result.retryable).toBe(false);
    expect(JSON.stringify(result)).not.toContain(key);
    expect(sanitizeSecrets(`failed ${key}`)).toBe("failed [redacted]");
  });

  it("不会把 fetch 当成其他对象的方法来调用", async () => {
    function strictFetch(this: unknown) {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return jsonResponse(200, {
        model: "deepseek-flash",
        choices: [{ message: { content: "{\"ok\":true}", reasoning_content: "思考" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 1 },
      });
    }
    const result = await completeJson({
      fetchImpl: strictFetch as unknown as typeof fetch,
      apiKey: key,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      messages: [{ role: "user", content: "json" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toBe('{"ok":true}');
    expect(result.content).not.toContain("思考");
  });

  it("429 与 5xx 可以重试，402 不行", async () => {
    const rateLimited = await completeJson({
      fetchImpl: async () => jsonResponse(429, {}),
      apiKey: key,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      messages: [],
    });
    const overloaded = await completeJson({
      fetchImpl: async () => jsonResponse(503, {}),
      apiKey: key,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      messages: [],
    });
    const balance = await completeJson({
      fetchImpl: async () => jsonResponse(402, {}),
      apiKey: key,
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      messages: [],
    });
    expect(rateLimited).toMatchObject({ retryable: true, code: "rate_limited" });
    expect(overloaded).toMatchObject({ retryable: true, code: "upstream_unavailable" });
    expect(balance).toMatchObject({ retryable: false, code: "upstream_balance" });
  });
});
