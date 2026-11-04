import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { TravelDatabase } from "@/db/database";

const opened: TravelDatabase[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((database) => database.delete()));
});

describe("v1 到 v2 迁移", () => {
  it("把扁平行程拆成日期、景点和住宿", async () => {
    const name = `legacy-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      trips: "id, updatedAt",
      itinerary: "id, tripId, dayDate, order",
    });
    await legacy.open();
    await legacy.table("trips").add({
      id: "t1",
      name: "旧行程",
      destination: "大阪",
      startDate: "2026-12-01",
      endDate: "2026-12-02",
      summary: "升级前",
      createdAt: 1,
      updatedAt: 2,
    });
    await legacy.table("itinerary").bulkAdd([
      {
        id: "i1",
        tripId: "t1",
        dayDate: "2026-12-01",
        dayTitle: "抵达",
        dayNote: "先安顿",
        order: 1,
        kind: "lodging",
        name: "旅店",
        area: "中央",
        note: "靠近车站",
        timeLabel: "18:00",
        checkIn: "2026-12-01",
        checkOut: "2026-12-02",
      },
      {
        id: "i2",
        tripId: "t1",
        dayDate: "2026-12-01",
        dayTitle: "抵达",
        dayNote: "先安顿",
        order: 0,
        kind: "place",
        name: "城公园",
        area: "中央",
        note: "散步",
        timeLabel: "10:00",
      },
    ]);
    legacy.close();

    const upgraded = new TravelDatabase(name, { seed: false });
    opened.push(upgraded);
    await upgraded.open();

    const trip = await upgraded.trips.get("t1");
    expect(trip?.title).toBe("旧行程");
    expect(trip).not.toHaveProperty("name");
    const days = await upgraded.days.toArray();
    expect(days.map((day) => day.title)).toEqual(["抵达"]);
    const places = await upgraded.places.toArray();
    const lodgings = await upgraded.lodgings.toArray();
    expect(places.map((place) => place.name)).toEqual(["城公园"]);
    expect(lodgings.map((lodging) => lodging.name)).toEqual(["旅店"]);
    const items = (await upgraded.timelineItems.toArray()).sort(
      (a, b) => a.order - b.order,
    );
    expect(items.map((item) => item.kind)).toEqual(["place", "lodging"]);
    expect(items.every((item) => item.locked === false)).toBe(true);
    expect(upgraded.tables.map((table) => table.name)).not.toContain("itinerary");
  });
});
