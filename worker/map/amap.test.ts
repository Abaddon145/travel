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
    expect(route).toMatchObject({
      distanceMeters: 860,
      durationSeconds: 720,
      polyline: "135.1,34.9;135.2,35.0",
    });
    expect(parseRoute({ route: { paths: [{}] } }, "walking")).toBeNull();
  });

  it("公交轨迹由步行和乘车分段折线拼成", () => {
    const route = parseRoute(
      {
        route: {
          transits: [
            {
              distance: "3327",
              cost: { duration: "2159" },
              segments: [
                {
                  walking: { steps: [{ polyline: "120.10,30.20;120.11,30.21" }] },
                  bus: {
                    steps: [{ polyline: "120.11,30.21;120.15,30.22" }],
                    buslines: [{ type: "地铁线路", polyline: "120.15,30.22;120.20,30.25" }],
                  },
                },
                {
                  railway: { steps: [{ polyline: "120.20,30.25;120.30,30.30" }] },
                  taxi: { polyline: "120.30,30.30;120.31,30.31" },
                },
              ],
            },
          ],
        },
      },
      "transit",
    );
    expect(route).toMatchObject({ distanceMeters: 3327, durationSeconds: 2159 });
    expect(route?.polyline).toBe(
      [
        "120.10,30.20;120.11,30.21",
        "120.11,30.21;120.15,30.22",
        "120.15,30.22;120.20,30.25",
        "120.20,30.25;120.30,30.30",
        "120.30,30.30;120.31,30.31",
      ].join(";"),
    );
  });

  it("公交没有分段折线时不编造轨迹", () => {
    const route = parseRoute(
      {
        route: {
          transits: [
            {
              distance: "3327",
              cost: { duration: "2159" },
              segments: [
                {
                  walking: { steps: [{ instruction: "步行" }] },
                  bus: { buslines: [{ name: "1路" }] },
                },
              ],
            },
          ],
        },
      },
      "transit",
    );
    expect(route).toMatchObject({ distanceMeters: 3327, durationSeconds: 2159, polyline: "" });
  });

  it("v3 公交用方案 duration，并保留 buslines 折线", () => {
    const route = parseRoute(
      {
        route: {
          transits: [
            {
              distance: "3327",
              duration: "2159",
              segments: [
                {
                  walking: { steps: [{ polyline: "120.14,30.25;120.15,30.25" }] },
                  bus: { buslines: [{ name: "地铁1号线", polyline: "120.15,30.25;120.16,30.26" }] },
                },
              ],
            },
          ],
        },
      },
      "transit",
    );
    expect(route).toEqual({
      mode: "transit",
      distanceMeters: 3327,
      durationSeconds: 2159,
      polyline: "120.14,30.25;120.15,30.25;120.15,30.25;120.16,30.26",
    });
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
