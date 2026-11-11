import { describe, expect, it } from "vitest";
import { nextStop, pickFocusTrip, tripPhase, tripStatusLabel } from "@/lib/trip-phase";
import type { TripDetail, TripSummary } from "@/domain/types";

const today = new Date(2026, 10, 13);

function summary(patch: Partial<TripSummary>): TripSummary {
  return {
    id: "trip",
    title: "行程",
    destination: "京都",
    startDate: "2026-11-12",
    endDate: "2026-11-16",
    summary: "",
    dayCount: 5,
    updatedAt: 0,
    ...patch,
  };
}

describe("行程阶段", () => {
  it("出发前、进行中、结束后用不同说法", () => {
    expect(tripPhase(summary({ startDate: "2026-11-20", endDate: "2026-11-22" }), today)).toBe(
      "upcoming",
    );
    expect(tripStatusLabel(summary({ startDate: "2026-11-14", endDate: "2026-11-16" }), today)).toBe(
      "明天出发",
    );
    expect(tripStatusLabel(summary({}), today)).toBe("第 2 天 · 共 5 天");
    expect(tripPhase(summary({ startDate: "2026-11-01", endDate: "2026-11-02" }), today)).toBe(
      "past",
    );
    expect(tripStatusLabel(summary({ startDate: "2026-11-01", endDate: "2026-11-02" }), today)).toBe(
      "已结束",
    );
  });

  it("优先进行中，其次最近的即将出发", () => {
    const trips = [
      summary({ id: "past", startDate: "2026-10-01", endDate: "2026-10-03" }),
      summary({ id: "later", startDate: "2026-12-01", endDate: "2026-12-03" }),
      summary({ id: "now", startDate: "2026-11-12", endDate: "2026-11-16" }),
    ];
    expect(pickFocusTrip(trips, today)?.id).toBe("now");
    expect(pickFocusTrip(trips.filter((trip) => trip.id !== "now"), today)?.id).toBe("later");
  });

  it("下一站取今天还没到的项目，否则取之后第一天", () => {
    const detail = {
      ...summary({}),
      days: [
        {
          id: "d1",
          date: "2026-11-13",
          title: "东山",
          note: "",
          order: 0,
          items: [
            item("early", "09:00"),
            item("later", "18:00"),
          ],
        },
        {
          id: "d2",
          date: "2026-11-14",
          title: "岚山",
          note: "",
          order: 1,
          items: [item("bridge", "10:00")],
        },
      ],
    } as TripDetail;
    expect(nextStop(detail, new Date(2026, 10, 13, 12, 0))?.item.id).toBe("later");
    expect(nextStop(detail, new Date(2026, 10, 13, 20, 0))?.item.id).toBe("bridge");
  });
});

function item(id: string, timeLabel: string) {
  return {
    id,
    kind: "place" as const,
    refId: id,
    name: id,
    area: "",
    note: "",
    timeLabel,
    locked: false,
    order: 0,
  };
}
