import { describe, expect, it } from "vitest";
import { getTripDetail, listTripSummaries } from "@/data/mock-trips";

describe("模拟行程", () => {
  it("列出两趟旅行并按更新时间倒序", () => {
    const titles = listTripSummaries().map((trip) => trip.title);
    expect(titles).toEqual(["杭州周末", "京都秋日"]);
  });

  it("把京都的天和项目按顺序接在一起", () => {
    const detail = getTripDetail("trip-kyoto");
    expect(detail?.days.map((day) => day.title)).toEqual([
      "抵达白川",
      "东山",
      "伏见与岚山",
      "北野",
      "离开",
    ]);
    expect(detail?.days[1]?.items.map((item) => item.name)).toEqual(["清水寺", "二年坂"]);
    expect(detail?.days[0]?.items[0]).toMatchObject({
      name: "白川庵",
      kind: "lodging",
      locked: true,
    });
  });

  it("未知行程返回空", () => {
    expect(getTripDetail("missing")).toBeUndefined();
  });
});
