import type { Transaction } from "dexie";

type LegacyTrip = {
  id: string;
  name?: string;
  title?: string;
  destination: string;
  startDate: string;
  endDate: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
};

type LegacyItinerary = {
  id: string;
  tripId: string;
  dayDate: string;
  dayTitle?: string;
  dayNote?: string;
  order: number;
  kind: "place" | "lodging";
  name: string;
  area?: string;
  note?: string;
  timeLabel?: string;
  locked?: boolean;
  checkIn?: string;
  checkOut?: string;
};

/**
 * v1 stored a flat `itinerary` row per stop and called the trip title `name`.
 * v2 splits days, places, lodgings, and ordered timeline items.
 * The old table is removed in v3, after this upgrade has copied the rows.
 */
export async function migrateV1ToV2(tx: Transaction) {
  const trips = await tx.table("trips").toArray();
  for (const raw of trips as LegacyTrip[]) {
    if (typeof raw.name === "string" && raw.title == null) {
      const { name, ...rest } = raw;
      await tx.table("trips").put({ ...rest, title: name });
    }
  }

  const rows = (await tx.table("itinerary").toArray()) as LegacyItinerary[];
  const groups = new Map<
    string,
    {
      tripId: string;
      dayDate: string;
      dayTitle: string;
      dayNote: string;
      rows: LegacyItinerary[];
    }
  >();

  for (const row of rows) {
    const key = `${row.tripId}:${row.dayDate}`;
    const group = groups.get(key) ?? {
      tripId: row.tripId,
      dayDate: row.dayDate,
      dayTitle: row.dayTitle?.trim() || "未命名的一天",
      dayNote: row.dayNote ?? "",
      rows: [],
    };
    group.rows.push(row);
    groups.set(key, group);
  }

  const now = Date.now();
  const grouped = [...groups.values()].sort((a, b) => {
    if (a.tripId !== b.tripId) return a.tripId.localeCompare(b.tripId);
    return a.dayDate.localeCompare(b.dayDate);
  });
  let dayOrder = 0;
  let currentTrip = "";

  for (const group of grouped) {
    if (group.tripId !== currentTrip) {
      currentTrip = group.tripId;
      dayOrder = 0;
    }
    const dayId = `day-${group.tripId}-${group.dayDate}`;
    await tx.table("days").put({
      id: dayId,
      tripId: group.tripId,
      date: group.dayDate,
      title: group.dayTitle,
      note: group.dayNote,
      order: dayOrder,
      createdAt: now,
      updatedAt: now,
    });
    dayOrder += 1;

    const ordered = [...group.rows].sort((a, b) => a.order - b.order);
    for (const [index, row] of ordered.entries()) {
      const refId = `ref-${row.id}`;
      const shared = {
        id: refId,
        tripId: row.tripId,
        name: row.name,
        area: row.area ?? "",
        note: row.note ?? "",
        createdAt: now,
        updatedAt: now,
      };
      if (row.kind === "lodging") {
        await tx.table("lodgings").put({
          ...shared,
          checkIn: row.checkIn ?? "",
          checkOut: row.checkOut ?? "",
        });
      } else {
        await tx.table("places").put(shared);
      }
      await tx.table("timelineItems").put({
        id: row.id,
        tripId: row.tripId,
        dayId,
        kind: row.kind,
        refId,
        order: index,
        locked: row.locked === true,
        timeLabel: row.timeLabel ?? "",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}
