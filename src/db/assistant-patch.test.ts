import { afterEach, describe, expect, it } from "vitest";
import { TravelDatabase } from "@/db/database";
import { LockedItemError } from "@/db/errors";
import {
  applyAssistantPatch,
  createDay,
  createTimelineItem,
  createTrip,
  readTripDetail,
  restoreVersion,
  setTimelineLock,
} from "@/db/repository";

const opened: TravelDatabase[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((database) => database.delete()));
});

describe("助手写入", () => {
  it("不改锁定项目，未锁定的修改可以撤销", async () => {
    const database = new TravelDatabase(`assistant-${crypto.randomUUID()}`, { seed: false });
    opened.push(database);
    await database.open();
    const trip = await createTrip(database, {
      title: "测试",
      destination: "杭州",
      startDate: "2026-11-21",
      endDate: "2026-11-21",
      summary: "",
    });
    await createDay(database, trip.id, { date: "2026-11-21", title: "西湖", note: "" });
    const before = await readTripDetail(database, trip.id);
    const day = before?.days[0];
    if (!day) throw new Error("missing day");
    await createTimelineItem(database, day.id, {
      kind: "lodging",
      name: "湖滨小馆",
      area: "湖滨",
      note: "住下",
      timeLabel: "15:00",
      checkIn: "2026-11-21",
      checkOut: "2026-11-22",
    });
    await createTimelineItem(database, day.id, {
      kind: "place",
      name: "白堤",
      area: "西湖",
      note: "旧备注",
      timeLabel: "17:00",
      checkIn: "",
      checkOut: "",
    });
    const detail = await readTripDetail(database, trip.id);
    const lodging = detail?.days[0]?.items.find((item) => item.name === "湖滨小馆");
    const place = detail?.days[0]?.items.find((item) => item.name === "白堤");
    if (!lodging || !place) throw new Error("missing items");
    await setTimelineLock(database, lodging.id, true);
    await expect(
      applyAssistantPatch(database, trip.id, [{ op: "remove", itemId: lodging.id }]),
    ).rejects.toBeInstanceOf(LockedItemError);
    expect((await readTripDetail(database, trip.id))?.days[0]?.items.map((item) => item.name)).toEqual([
      "湖滨小馆",
      "白堤",
    ]);
    const versionId = await applyAssistantPatch(database, trip.id, [
      { op: "update", itemId: place.id, note: "雨天改去室内" },
    ]);
    expect(
      (await readTripDetail(database, trip.id))?.days[0]?.items.find((item) => item.id === place.id)?.note,
    ).toBe("雨天改去室内");
    if (!versionId) throw new Error("missing version");
    await restoreVersion(database, versionId);
    expect(
      (await readTripDetail(database, trip.id))?.days[0]?.items.find((item) => item.id === place.id)?.note,
    ).toBe("旧备注");
  });
});
