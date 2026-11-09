import { afterEach, describe, expect, it } from "vitest";
import { TravelDatabase } from "@/db/database";
import { createTrip, deleteTrip, restoreDeletedTrip } from "@/db/repository";
import {
  createBooking,
  createChecklistItem,
  createFavorite,
  createLedgerEntry,
  createTravelNote,
  readTripTools,
  updateChecklistItem,
} from "@/db/tools";

const opened: TravelDatabase[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((database) => database.delete()));
});

const tripInput = {
  title: "记账行程",
  destination: "京都",
  startDate: "2026-12-01",
  endDate: "2026-12-03",
  summary: "",
};

describe("旅行工具持久化", () => {
  it("关闭再打开后，账本、预订、清单、收藏和备注都还在", async () => {
    const name = `tools-${crypto.randomUUID()}`;
    const first = new TravelDatabase(name, { seed: false });
    opened.push(first);
    await first.open();
    const trip = await createTrip(first, tripInput);
    await createLedgerEntry(first, trip.id, {
      date: "2026-12-01",
      category: "food",
      title: "晚饭",
      note: "",
      currency: "CNY",
      plannedMinor: 10,
      actualMinor: 20,
    });
    await createBooking(first, trip.id, {
      kind: "train",
      title: "のぞみ 1",
      date: "2026-12-01",
      endDate: "",
      reference: "1A",
      detail: "东京 → 京都",
      note: "",
    });
    const item = await createChecklistItem(first, trip.id, {
      title: "护照",
      note: "",
      done: false,
    });
    await updateChecklistItem(first, item.id, { title: "护照", note: "夹层", done: true });
    await createFavorite(first, trip.id, { title: "锦市场", note: "上午" });
    await createTravelNote(first, trip.id, {
      title: "雨天",
      body: "改去室内。",
      date: "",
    });
    first.close();

    const second = new TravelDatabase(name, { seed: false });
    opened.push(second);
    await second.open();
    const tools = await readTripTools(second, trip.id);
    expect(tools.ledgerEntries.map((entry) => [entry.title, entry.plannedMinor, entry.actualMinor])).toEqual([
      ["晚饭", 10, 20],
    ]);
    expect(tools.bookings.map((booking) => booking.title)).toEqual(["のぞみ 1"]);
    expect(tools.checklistItems.map((row) => [row.title, row.done, row.note])).toEqual([
      ["护照", true, "夹层"],
    ]);
    expect(tools.favorites.map((row) => row.title)).toEqual(["锦市场"]);
    expect(tools.travelNotes.map((row) => row.body)).toEqual(["改去室内。"]);
  });

  it("删除行程会带走工具记录，撤销后恢复", async () => {
    const database = new TravelDatabase(`undo-${crypto.randomUUID()}`, { seed: false });
    opened.push(database);
    await database.open();
    const trip = await createTrip(database, tripInput);
    await createLedgerEntry(database, trip.id, {
      date: "",
      category: "lodging",
      title: "订金",
      note: "",
      currency: "JPY",
      plannedMinor: 1000,
      actualMinor: null,
    });
    await createChecklistItem(database, trip.id, { title: "伞", note: "", done: false });
    const deleted = await deleteTrip(database, trip.id);
    expect(await database.ledgerEntries.count()).toBe(0);
    expect(await database.checklistItems.count()).toBe(0);
    await restoreDeletedTrip(database, deleted);
    const tools = await readTripTools(database, trip.id);
    expect(tools.ledgerEntries.map((entry) => entry.title)).toEqual(["订金"]);
    expect(tools.ledgerEntries[0]?.actualMinor).toBeNull();
    expect(tools.checklistItems.map((item) => item.title)).toEqual(["伞"]);
  });
});
