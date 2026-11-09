import { afterEach, describe, expect, it } from "vitest";
import {
  applyImport,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  exportBackup,
  parseBackup,
  previewImport,
} from "@/db/backup";
import { TravelDatabase } from "@/db/database";
import { BackupError } from "@/db/errors";

const opened: TravelDatabase[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((database) => database.delete()));
  localStorage.removeItem("lvxu-owner-key");
});

function open(seed = false) {
  const database = new TravelDatabase(`backup-${crypto.randomUUID()}`, { seed });
  opened.push(database);
  return database;
}

const trip = {
  id: "t1",
  title: "仍在",
  destination: "京都",
  startDate: "2026-11-10",
  endDate: "2026-11-12",
  summary: "原来的",
  createdAt: 1,
  updatedAt: 10,
};

describe("备份往返", () => {
  it("导出的表与当前 Dexie 一致，且不含私人密钥", async () => {
    localStorage.setItem("lvxu-owner-key", "super-secret-owner");
    const database = open(true);
    await database.open();
    expect([...BACKUP_TABLES].sort()).toEqual(database.tables.map((table) => table.name).sort());
    const file = await exportBackup(database, new Date("2026-11-09T00:00:00.000Z"));
    expect(file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(file.format).toBe("lvxu-backup");
    expect(file.tables.ledgerEntries.length).toBeGreaterThan(0);
    expect(file.tables.bookings.length).toBeGreaterThan(0);
    expect(file.tables.checklistItems.length).toBeGreaterThan(0);
    expect(file.tables.favorites.length).toBeGreaterThan(0);
    expect(file.tables.travelNotes.length).toBeGreaterThan(0);
    expect(JSON.stringify(file)).not.toContain("super-secret-owner");
    expect(JSON.stringify(file)).not.toContain("lvxu-owner-key");

    const restored = open(false);
    await restored.open();
    await applyImport(restored, parseBackup(file), "replace");
    const again = await exportBackup(restored, new Date("2026-11-09T00:00:00.000Z"));
    expect(again).toEqual(file);
  });

  it("合并保留较新的本机记录，并补上备份里没有的行程", async () => {
    const database = open(false);
    await database.open();
    await database.trips.add(trip);
    await database.trips.add({ ...trip, id: "local-only", title: "只在本机", updatedAt: 3 });
    const incoming = {
      format: "lvxu-backup",
      schemaVersion: 7,
      app: "lvxu-travel",
      tables: {
        trips: [
          { ...trip, title: "备份更旧", updatedAt: 5 },
          { ...trip, id: "from-backup", title: "来自备份", updatedAt: 4 },
        ],
      },
    };
    const preview = await previewImport(database, incoming);
    expect(preview.preview.merge).toMatchObject({ insert: 1, update: 0 });
    await applyImport(database, preview.data, "merge");
    expect((await database.trips.get("t1"))?.title).toBe("仍在");
    expect((await database.trips.get("local-only"))?.title).toBe("只在本机");
    expect((await database.trips.get("from-backup"))?.title).toBe("来自备份");

    const newer = {
      ...incoming,
      tables: { trips: [{ ...trip, title: "备份更新", updatedAt: 20 }] },
    };
    await applyImport(database, parseBackup(newer), "merge");
    expect((await database.trips.get("t1"))?.title).toBe("备份更新");
    expect((await database.trips.get("local-only"))?.title).toBe("只在本机");
  });
});

describe("旧版本迁移", () => {
  it("把版本 1 的扁平行程拆成当前库", async () => {
    const database = open(false);
    await database.open();
    await database.trips.add(trip);
    const legacy = {
      schemaVersion: 1,
      trips: [
        {
          id: "old",
          name: "旧行程",
          destination: "大阪",
          startDate: "2026-12-01",
          endDate: "2026-12-02",
          summary: "升级前",
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      itinerary: [
        {
          id: "i1",
          tripId: "old",
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
          tripId: "old",
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
      ],
    };
    const preview = await previewImport(database, legacy, 50);
    expect(preview.preview.migratedFrom).toBe(1);
    expect(preview.preview.counts.trips).toBe(1);
    expect(preview.preview.counts.ledgerEntries).toBe(0);
    await applyImport(database, preview.data, "replace");
    expect((await database.trips.get("old"))?.title).toBe("旧行程");
    expect(await database.trips.get("t1")).toBeUndefined();
    expect((await database.days.toArray()).map((day) => day.title)).toEqual(["抵达"]);
    expect((await database.places.toArray()).map((place) => place.name)).toEqual(["城公园"]);
    expect((await database.places.toArray())[0]?.mapSource).toBe("unverified");
    expect((await database.lodgings.toArray()).map((lodging) => lodging.name)).toEqual(["旅店"]);
    const items = (await database.timelineItems.toArray()).sort((a, b) => a.order - b.order);
    expect(items.map((item) => item.kind)).toEqual(["place", "lodging"]);
    expect(await database.ledgerEntries.count()).toBe(0);
    expect(database.verno).toBe(BACKUP_SCHEMA_VERSION);
  });

  it("版本 4 补上未核实地点，版本 6 保留路线选择", async () => {
    const database = open(false);
    await database.open();
    const place = {
      id: "p1",
      tripId: "t1",
      name: "城公园",
      area: "中央",
      note: "",
      createdAt: 1,
      updatedAt: 2,
    };
    const version4 = {
      format: "lvxu-backup",
      schemaVersion: 4,
      app: "lvxu-travel",
      tables: {
        trips: [trip],
        places: [place],
        aiUsage: [
          {
            id: "u1",
            createdAt: 3,
            destination: "京都",
            model: "deepseek-flash",
            promptTokens: 1,
            completionTokens: 1,
            totalTokens: 2,
          },
        ],
      },
    };
    await applyImport(database, parseBackup(version4), "replace");
    expect((await database.places.get("p1"))?.mapSource).toBe("unverified");
    expect(await database.aiUsage.count()).toBe(1);
    expect(await database.ledgerEntries.count()).toBe(0);

    const version6 = {
      format: "lvxu-backup",
      schemaVersion: 6,
      app: "lvxu-travel",
      tables: {
        trips: [trip],
        routePicks: [
          {
            id: "pick-1",
            tripId: "t1",
            fromItemId: "a",
            toItemId: "b",
            mode: "walking",
          },
        ],
      },
    };
    await applyImport(database, parseBackup(version6), "merge");
    expect((await database.routePicks.get("pick-1"))?.mode).toBe("walking");
    expect((await database.places.get("p1"))?.name).toBe("城公园");
    expect(await database.ledgerEntries.count()).toBe(0);
  });
});

describe("导入失败不破坏现有数据", () => {
  it("校验失败发生在写入之前", async () => {
    const database = open(false);
    await database.open();
    await database.trips.add(trip);
    await expect(previewImport(database, { format: "nope" })).rejects.toBeInstanceOf(BackupError);
    await expect(
      previewImport(database, {
        format: "lvxu-backup",
        schemaVersion: 8,
        app: "lvxu-travel",
        tables: { trips: [trip] },
      }),
    ).rejects.toThrow("这份备份来自更新的旅序");
    await expect(
      previewImport(database, {
        format: "lvxu-backup",
        schemaVersion: 7,
        app: "lvxu-travel",
        tables: { trips: [{ id: "bad" }] },
      }),
    ).rejects.toThrow(/行程第 1 条/);
    expect((await database.trips.get("t1"))?.title).toBe("仍在");
    expect(await database.trips.count()).toBe(1);
  });

  it("事务中途失败时整段撤回", async () => {
    const database = open(false);
    await database.open();
    await database.trips.add(trip);
    const incoming = parseBackup({
      format: "lvxu-backup",
      schemaVersion: 7,
      app: "lvxu-travel",
      tables: {
        trips: [{ ...trip, id: "next", title: "不该留下", updatedAt: 30 }],
        ledgerEntries: [
          {
            id: "ledger-1",
            tripId: "next",
            date: "2026-11-10",
            category: "food",
            title: "晚饭",
            note: "",
            currency: "CNY",
            plannedMinor: 1999,
            actualMinor: null,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      },
    });
    await expect(
      applyImport(database, incoming, "replace", {
        beforeFinish() {
          throw new Error("disk");
        },
      }),
    ).rejects.toThrow("写入没有完成，这台设备上的数据保持原样。");
    expect((await database.trips.get("t1"))?.title).toBe("仍在");
    expect(await database.trips.get("next")).toBeUndefined();
    expect(await database.ledgerEntries.count()).toBe(0);
  });
});
