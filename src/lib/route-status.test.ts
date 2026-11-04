import { describe, expect, it } from "vitest";
import { presentRoute, type StoredRoute } from "@/lib/route-status";

const now = Date.parse("2026-11-04T00:00:00Z");

function route(patch: Partial<StoredRoute> = {}): StoredRoute {
  return {
    id: "r1",
    tripId: "t1",
    fromItemId: "a",
    toItemId: "b",
    mode: "walking",
    ok: true,
    distanceMeters: 860,
    durationSeconds: 720,
    polyline: "135.1,34.9;135.2,35.0",
    fetchedAt: now,
    fromPoiId: "p1",
    toPoiId: "p2",
    ...patch,
  };
}

describe("路段核实", () => {
  it("没有高德路线时不显示距离", () => {
    expect(presentRoute(null, { fromPoiId: "", toPoiId: "" }, now)).toEqual({
      status: "unverified",
      label: "未核实",
      detail: null,
    });
    expect(presentRoute(route({ ok: false, distanceMeters: null }), { fromPoiId: "p1", toPoiId: "p2" }, now).detail).toBeNull();
  });

  it("过期或地点变了就不再把旧距离当成当前路线", () => {
    const endpoints = { fromPoiId: "p1", toPoiId: "p2" };
    expect(presentRoute(route(), endpoints, now).detail).toBe("步行 860 米 · 12 分钟");
    expect(presentRoute(route({ fetchedAt: now - 8 * 24 * 60 * 60 * 1000 }), endpoints, now).status).toBe("stale");
    expect(presentRoute(route(), { fromPoiId: "other", toPoiId: "p2" }, now).detail).toBeNull();
  });
});
