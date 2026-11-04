// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { amapGet, mapInfocode, parsePois, parseRoute } from "./amap";

function payload(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("高德 REST", () => {
  it("fetch 必须绑在全局对象上", async () => {
    function strictFetch(this: unknown) {
      if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
      return payload({
        status: "1",
        infocode: "10000",
        pois: [{ id: "B1", name: "清水寺", address: "东山", location: "135.785,34.995", distance: "120" }],
      });
    }
    const result = await amapGet({
      fetchImpl: strictFetch as unknown as typeof fetch,
      key: "web-key",
      path: "/v5/place/around",
      query: { location: "135.780,34.990" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(parsePois(result.payload)[0]).toMatchObject({
      id: "B1",
      distanceMeters: 120,
    });
  });

  it("关键字搜索没有距离字段时不编造距离", () => {
    const pois = parsePois({
      pois: [{ id: "B2", name: "岚山", address: "右京", location: "135.666,35.016" }],
    });
    expect(pois[0]?.distanceMeters).toBeUndefined();
  });

  it("只接受高德返回的路线距离", () => {
    expect(mapInfocode("10003")).toBe("quota_exceeded");
    expect(mapInfocode("10004")).toBe("rate_limited");
    expect(mapInfocode("10001")).toBe("not_configured");
    expect(mapInfocode("20000")).toBe("validation_error");
    const route = parseRoute(
      {
        route: {
          paths: [
            {
              distance: "860",
              cost: { duration: "720" },
              steps: [{ polyline: "135.1,34.9;135.2,35.0" }],
            },
          ],
        },
      },
      "walking",
    );
    expect(route).toMatchObject({ distanceMeters: 860, durationSeconds: 720 });
    expect(parseRoute({ route: { paths: [{}] } }, "walking")).toBeNull();
  });

  it("失败的 infocode 不会当成成功", async () => {
    const result = await amapGet({
      fetchImpl: vi.fn(async () => payload({ status: "0", infocode: "10009" })) as unknown as typeof fetch,
      key: "web-key",
      path: "/v5/place/text",
      query: { keywords: "清水寺" },
    });
    expect(result).toMatchObject({ ok: false, error: "not_configured" });
  });
});
