import { afterEach, describe, expect, it } from "vitest";
import { TravelDatabase } from "@/db/database";
import {
  ConflictError,
  DataIntegrityError,
  LockedItemError,
  ValidationError,
} from "@/db/errors";
import {
  createDay,
  createTimelineItem,
  createTrip,
  saveGeneratedDraft,
  deleteTimelineItem,
  moveTimelineItem,
  readTripDetail,
  readTripSummaries,
  readVersions,
  restoreVersion,
  setTimelineLock,
  updateTimelineItem,
  updateTrip,
} from "@/db/repository";

const opened: TravelDatabase[] = [];

async function openFresh() {
  const database = new TravelDatabase(`repo-${crypto.randomUUID()}`, { seed: false });
  opened.push(database);
  await database.open();
  return database;
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((database) => database.delete()));
});

const tripInput = {
  title: "测试行程",
  destination: "京都",
  startDate: "2026-12-01",
  endDate: "2026-12-03",
  summary: "只在本地",
};

async function tripWithDay(database: TravelDatabase) {
  const trip = await createTrip(database, tripInput);
  await createDay(database, trip.id, { date: "2026-12-01", title: "第一天", note: "" });
  const detail = await readTripDetail(database, trip.id);
  const day = detail?.days[0];
  if (!day) throw new Error("缺少日期");
  return { trip, day };
}

describe("行程仓储", () => {
  it("创建、修改并在首次打开时播种示例", async () => {
    const seeded = new TravelDatabase(`seed-${crypto.randomUUID()}`);
    opened.push(seeded);
    await seeded.open();
    expect(await seeded.trips.count()).toBe(2);

    const database = await openFresh();
    const trip = await createTrip(database, tripInput);
    await updateTrip(database, trip.id, { ...tripInput, title: "改过的行程" });
    const summaries = await readTripSummaries(database);
    expect(summaries.map((item) => item.title)).toContain("改过的行程");
    await expect(
      createTrip(database, { ...tripInput, title: "" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("拒绝重复日期，并保持时间线顺序", async () => {
    const database = await openFresh();
    const { trip, day } = await tripWithDay(database);
    await expect(
      createDay(database, trip.id, { date: day.date, title: "重复", note: "" }),
    ).rejects.toBeInstanceOf(ConflictError);

    await createTimelineItem(database, day.id, {
      kind: "place",
      name: "甲",
      area: "",
      note: "",
      timeLabel: "09:00",
      checkIn: "",
      checkOut: "",
    });
    await createTimelineItem(database, day.id, {
      kind: "place",
      name: "乙",
      area: "",
      note: "",
      timeLabel: "10:00",
      checkIn: "",
      checkOut: "",
    });
    await createTimelineItem(database, day.id, {
      kind: "lodging",
      name: "丙",
      area: "",
      note: "",
      timeLabel: "18:00",
      checkIn: "2026-12-01",
      checkOut: "2026-12-02",
    });
    let detail = await readTripDetail(database, trip.id);
    const third = detail?.days[0]?.items[2];
    if (!third) throw new Error("缺少第三项");
    await moveTimelineItem(database, third.id, "up");
    detail = await readTripDetail(database, trip.id);
    expect(detail?.days[0]?.items.map((item) => item.name)).toEqual(["甲", "丙", "乙"]);
  });

  it("锁定后不能修改、移动或删除，解锁后可以", async () => {
    const database = await openFresh();
    const { trip, day } = await tripWithDay(database);
    await createTimelineItem(database, day.id, {
      kind: "place",
      name: "甲",
      area: "",
      note: "",
      timeLabel: "",
      checkIn: "",
      checkOut: "",
    });
    await createTimelineItem(database, day.id, {
      kind: "place",
      name: "乙",
      area: "",
      note: "",
      timeLabel: "",
      checkIn: "",
      checkOut: "",
    });
    const detail = await readTripDetail(database, trip.id);
    const first = detail?.days[0]?.items[0];
    const second = detail?.days[0]?.items[1];
    if (!first || !second) throw new Error("缺少项目");
    await setTimelineLock(database, first.id, true);
    const payload = {
      kind: "place" as const,
      name: "不该改成这个",
      area: "",
      note: "",
      timeLabel: "",
      checkIn: "",
      checkOut: "",
    };
    await expect(updateTimelineItem(database, first.id, payload)).rejects.toBeInstanceOf(
      LockedItemError,
    );
    await expect(deleteTimelineItem(database, first.id)).rejects.toBeInstanceOf(
      LockedItemError,
    );
    await expect(moveTimelineItem(database, first.id, "down")).rejects.toBeInstanceOf(
      LockedItemError,
    );
    await expect(moveTimelineItem(database, second.id, "up")).rejects.toBeInstanceOf(
      LockedItemError,
    );
    await setTimelineLock(database, first.id, false);
    await deleteTimelineItem(database, first.id);
    const after = await readTripDetail(database, trip.id);
    expect(after?.days[0]?.items.map((item) => item.name)).toEqual(["乙"]);
  });

  it("修改前留下版本，并能恢复", async () => {
    const database = await openFresh();
    const trip = await createTrip(database, tripInput);
    await updateTrip(database, trip.id, { ...tripInput, title: "新标题" });
    const versions = await readVersions(database, trip.id);
    const prior = versions.find((version) => version.label === "修改行程之前");
    expect(prior?.snapshot.trip.title).toBe("测试行程");
    if (!prior) throw new Error("缺少版本");
    await restoreVersion(database, prior.id);
    const restored = await readTripDetail(database, trip.id);
    expect(restored?.title).toBe("测试行程");
    const after = await readVersions(database, trip.id);
    expect(after.some((version) => version.label === "恢复前的行程")).toBe(true);
  });

  it("读到损坏记录时失败，而不是静默丢掉", async () => {
    const database = await openFresh();
    await database.trips.add({
      id: "bad",
      title: "",
      destination: "",
      startDate: "not-a-date",
      endDate: "2026-01-01",
      summary: "",
      createdAt: 1,
      updatedAt: 1,
    });
    await expect(readTripSummaries(database)).rejects.toBeInstanceOf(DataIntegrityError);
  });

  it("把 AI 草稿保存成可再次打开的行程", async () => {
    const database = await openFresh();
    const id = await saveGeneratedDraft(database, {
      title: "京都秋日草稿",
      destination: "京都",
      startDate: "2026-11-10",
      endDate: "2026-11-11",
      summary: "寺与巷",
      warnings: [],
      days: [
        {
          date: "2026-11-10",
          title: "东山",
          note: "",
          items: [
            {
              kind: "place",
              name: "清水寺",
              area: "东山",
              note: "",
              timeLabel: "09:30",
              checkIn: "",
              checkOut: "",
            },
          ],
        },
        {
          date: "2026-11-11",
          title: "离店",
          note: "",
          items: [
            {
              kind: "lodging",
              name: "町家",
              area: "祗园",
              note: "",
              timeLabel: "",
              checkIn: "2026-11-10",
              checkOut: "2026-11-11",
            },
          ],
        },
      ],
    });
    const detail = await readTripDetail(database, id);
    expect(detail?.title).toBe("京都秋日草稿");
    expect(detail?.days).toHaveLength(2);
    expect(detail?.days[0]?.items.map((item) => item.name)).toEqual(["清水寺"]);
  });
});
