import { describe, expect, it } from "vitest";
import { findScheduleConflicts } from "@/lib/schedule-conflicts";
import type { StoredRoute } from "@/lib/route-status";

const now = Date.parse("2026-11-04T00:00:00Z");

function route(durationSeconds: number | null, ok = true): StoredRoute {
  return {
    id: "a:b:walking",
    tripId: "t",
    fromItemId: "a",
    toItemId: "b",
    mode: "walking",
    ok,
    distanceMeters: ok ? 800 : null,
    durationSeconds,
    polyline: "120.1,30.2;120.2,30.3",
    fetchedAt: now,
    fromPoiId: "",
    toPoiId: "",
  };
}

const day = {
  id: "d1",
  items: [
    { id: "a", name: "白堤", order: 0, timeLabel: "09:00" },
    { id: "b", name: "湖滨", order: 1, timeLabel: "09:10" },
  ],
};

describe("时间冲突", () => {
  it("用已核实时长判断来不及，没有路线时不编造分钟", () => {
    expect(findScheduleConflicts([day], [route(1800)])[0]).toMatchObject({
      kind: "tight",
      message: "白堤 到 湖滨 只隔 10 分钟，已核实路线需要 30 分钟。",
    });
    const missing = findScheduleConflicts([day], [])[0];
    expect(missing).toMatchObject({ kind: "unverified" });
    expect(missing?.message).not.toMatch(/\d+ 分钟/);
  });

  it("后一项时间更早算作排序冲突", () => {
    expect(
      findScheduleConflicts(
        [
          {
            id: "d1",
            items: [
              { id: "a", name: "白堤", order: 0, timeLabel: "11:00" },
              { id: "b", name: "湖滨", order: 1, timeLabel: "09:00" },
            ],
          },
        ],
        [route(600)],
      )[0]?.kind,
    ).toBe("order");
  });
});
