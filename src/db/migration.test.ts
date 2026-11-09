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

  it("版本 4 保留行程并增加用量表", async () => {
    const name = `v3-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(3).stores({
      trips: "id, updatedAt",
      days: "id, tripId, date, [tripId+date]",
      places: "id, tripId",
      lodgings: "id, tripId",
      timelineItems: "id, tripId, dayId, order, [dayId+order]",
      versions: "id, tripId, createdAt",
    });
    await legacy.open();
    await legacy.table("trips").add({
      id: "keep",
      title: "仍在",
      destination: "京都",
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      summary: "",
      createdAt: 1,
      updatedAt: 1,
    });
    legacy.close();

    const upgraded = new TravelDatabase(name, { seed: false });
    opened.push(upgraded);
    await upgraded.open();
    expect((await upgraded.trips.get("keep"))?.title).toBe("仍在");
    await upgraded.aiUsage.add({
      id: "u1",
      createdAt: Date.now(),
      destination: "京都",
      model: "deepseek-flash",
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
      cacheHitTokens: 0,
      cacheMissTokens: 1,
      latencyMs: 1,
      attempts: 1,
    });
    expect(await upgraded.aiUsage.count()).toBe(1);
  });

  it("版本 5 保留行程并把旧地点标成未核实", async () => {
    const name = `v4-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(4).stores({
      trips: "id, updatedAt",
      days: "id, tripId, date, [tripId+date]",
      places: "id, tripId",
      lodgings: "id, tripId",
      timelineItems: "id, tripId, dayId, order, [dayId+order]",
      versions: "id, tripId, createdAt",
      aiUsage: "id, createdAt",
    });
    await legacy.open();
    await legacy.table("trips").add({ id: "keep", title: "仍在" });
    await legacy.table("places").add({ id: "p1", tripId: "keep", name: "清水寺" });
    legacy.close();
    const upgraded = new TravelDatabase(name, { seed: false });
    opened.push(upgraded);
    await upgraded.open();
    expect((await upgraded.trips.get("keep"))?.title).toBe("仍在");
    expect((await upgraded.places.get("p1"))?.mapSource).toBe("unverified");
    expect(upgraded.tables.some((table) => table.name === "mapRoutes")).toBe(true);
  });

  it("版本 6 保留行程并增加路线选择", async () => {
    const name = `v5-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(5).stores({
      trips: "id, updatedAt",
      mapRoutes: "id, tripId, fromItemId, toItemId",
    });
    await legacy.open();
    await legacy.table("trips").add({ id: "keep", title: "仍在" });
    legacy.close();
    const upgraded = new TravelDatabase(name, { seed: false });
    opened.push(upgraded);
    await upgraded.open();
    expect((await upgraded.trips.get("keep"))?.title).toBe("仍在");
    expect(upgraded.tables.some((table) => table.name === "routePicks")).toBe(true);
  });

  it("版本 7 保留行程和路线选择，并增加空的账本表", async () => {
    const name = `v6-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(6).stores({
      trips: "id, updatedAt",
      routePicks: "id, tripId, fromItemId, toItemId",
    });
    await legacy.open();
    await legacy.table("trips").add({ id: "keep", title: "仍在" });
    await legacy.table("routePicks").add({
      id: "pick",
      tripId: "keep",
      fromItemId: "a",
      toItemId: "b",
      mode: "walking",
    });
    legacy.close();
    const upgraded = new TravelDatabase(name, { seed: false });
    opened.push(upgraded);
    await upgraded.open();
    expect((await upgraded.trips.get("keep"))?.title).toBe("仍在");
    expect(await upgraded.routePicks.count()).toBe(1);
    expect(await upgraded.ledgerEntries.count()).toBe(0);
    expect(await upgraded.bookings.count()).toBe(0);
    expect(await upgraded.checklistItems.count()).toBe(0);
    expect(await upgraded.favorites.count()).toBe(0);
    expect(await upgraded.travelNotes.count()).toBe(0);
  });
});
