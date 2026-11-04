import type { StoredRoute } from "@/lib/route-status";
import { draftSchema } from "@shared/ai-schema";
import type {
  Day,
  Lodging,
  Place,
  TimelineEntry,
  TimelineItem,
  Trip,
  TripDetail,
  TripSnapshot,
  TripSummary,
  TripVersion,
} from "@/domain/types";
import type { TravelDatabase } from "@/db/database";
import {
  ConflictError,
  DataIntegrityError,
  LockedItemError,
  NotFoundError,
  StorageQuotaError,
  ValidationError,
  isQuotaError,
} from "@/db/errors";
import {
  parseDay,
  parseDayInput,
  parseItemInput,
  parseLodging,
  parsePlace,
  parseSnapshot,
  parseTimelineItem,
  parseTrip,
  parseTripInput,
  parseVersion,
  type DayInput,
  type ItemInput,
  type TripInput,
} from "@/db/validation";

const VERSION_LIMIT = 30;

function guard<T>(work: () => Promise<T>) {
  return work().catch((error: unknown) => {
    if (error instanceof StorageQuotaError) throw error;
    if (isQuotaError(error)) throw new StorageQuotaError();
    throw error;
  });
}

function createId() {
  return crypto.randomUUID();
}

function tables(db: TravelDatabase) {
  return [db.trips, db.days, db.places, db.lodgings, db.timelineItems, db.versions];
}

async function readGraph(
  db: TravelDatabase,
  tripId: string,
): Promise<TripSnapshot | null> {
  const tripRow = await db.trips.get(tripId);
  if (!tripRow) return null;
  try {
    return parseSnapshot({
      trip: tripRow,
      days: await db.days.where("tripId").equals(tripId).toArray(),
      places: await db.places.where("tripId").equals(tripId).toArray(),
      lodgings: await db.lodgings.where("tripId").equals(tripId).toArray(),
      timelineItems: await db.timelineItems.where("tripId").equals(tripId).toArray(),
    });
  } catch (error) {
    if (error instanceof ValidationError) throw new DataIntegrityError();
    throw error;
  }
}

async function writeVersion(
  db: TravelDatabase,
  tripId: string,
  label: string,
  snapshot: TripSnapshot,
) {
  const version: TripVersion = parseVersion({
    id: createId(),
    tripId,
    label,
    createdAt: Date.now(),
    snapshot,
  });
  await db.versions.add(version);
  const versions = await db.versions.where("tripId").equals(tripId).toArray();
  versions.sort((a, b) => b.createdAt - a.createdAt);
  const extra = versions.slice(VERSION_LIMIT);
  if (extra.length > 0) {
    await db.versions.bulkDelete(extra.map((item) => item.id));
  }
  return version.id;
}

async function touchTrip(db: TravelDatabase, tripId: string) {
  const trip = await db.trips.get(tripId);
  if (!trip) return;
  await db.trips.put(parseTrip({ ...trip, updatedAt: Date.now() }));
}

async function withPriorVersion(
  db: TravelDatabase,
  tripId: string,
  label: string,
  change: () => Promise<void>,
) {
  return db.transaction("rw", tables(db), async () => {
    const before = await readGraph(db, tripId);
    await change();
    if (!before) return null;
    return writeVersion(db, tripId, label, before);
  });
}

async function replaceGraph(db: TravelDatabase, snapshot: TripSnapshot) {
  const tripId = snapshot.trip.id;
  await db.timelineItems.where("tripId").equals(tripId).delete();
  await db.days.where("tripId").equals(tripId).delete();
  await db.places.where("tripId").equals(tripId).delete();
  await db.lodgings.where("tripId").equals(tripId).delete();
  await db.trips.put(snapshot.trip);
  if (snapshot.days.length) await db.days.bulkAdd(snapshot.days);
  if (snapshot.places.length) await db.places.bulkAdd(snapshot.places);
  if (snapshot.lodgings.length) await db.lodgings.bulkAdd(snapshot.lodgings);
  if (snapshot.timelineItems.length)
    await db.timelineItems.bulkAdd(snapshot.timelineItems);
}

function toEntry(
  item: TimelineItem,
  places: Map<string, Place>,
  lodgings: Map<string, Lodging>,
): TimelineEntry | null {
  if (item.kind === "place") {
    const place = places.get(item.refId);
    if (!place) return null;
    return {
      id: item.id,
      dayId: item.dayId,
      kind: "place",
      refId: item.refId,
      name: place.name,
      area: place.area,
      note: place.note,
      timeLabel: item.timeLabel,
      mapSource: place.mapSource,
      amapPoiId: place.amapPoiId,
      amapAddress: place.amapAddress,
      amapLng: place.amapLng,
      amapLat: place.amapLat,
      amapFetchedAt: place.amapFetchedAt,
      locked: item.locked,
      order: item.order,
    };
  }
  const lodging = lodgings.get(item.refId);
  if (!lodging) return null;
  return {
    id: item.id,
    dayId: item.dayId,
    kind: "lodging",
    refId: item.refId,
    name: lodging.name,
    area: lodging.area,
    note: lodging.note,
    timeLabel: item.timeLabel,
    locked: item.locked,
    order: item.order,
    checkIn: lodging.checkIn,
    checkOut: lodging.checkOut,
    mapSource: lodging.mapSource,
    amapPoiId: lodging.amapPoiId,
    amapAddress: lodging.amapAddress,
    amapLng: lodging.amapLng,
    amapLat: lodging.amapLat,
    amapFetchedAt: lodging.amapFetchedAt,
  };
}

function toSummary(trip: Trip, dayCount: number): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    summary: trip.summary,
    dayCount,
    updatedAt: trip.updatedAt,
  };
}

function requireItem(item: TimelineItem | undefined): TimelineItem {
  if (!item) throw new NotFoundError();
  return item;
}

async function assertDayDateFree(
  db: TravelDatabase,
  tripId: string,
  date: string,
  ignoreId?: string,
) {
  const existing = await db.days.where("[tripId+date]").equals([tripId, date]).first();
  if (existing && existing.id !== ignoreId) {
    throw new ConflictError("这一天已经在行程里。");
  }
}

export async function readTripSummaries(db: TravelDatabase): Promise<TripSummary[]> {
  return guard(async () => {
    const trips = (await db.trips.orderBy("updatedAt").reverse().toArray()).map(
      (trip) => {
        try {
          return parseTrip(trip);
        } catch (error) {
          if (error instanceof ValidationError) throw new DataIntegrityError();
          throw error;
        }
      },
    );
    const days = await db.days.toArray();
    return trips.map((trip) => ({
      ...toSummary(trip, days.filter((day) => day.tripId === trip.id).length),
    }));
  });
}

export async function readTripDetail(
  db: TravelDatabase,
  tripId: string,
): Promise<TripDetail | null> {
  return guard(async () => {
    const graph = await readGraph(db, tripId);
    if (!graph) return null;
    const placeById = new Map(graph.places.map((place) => [place.id, place]));
    const lodgingById = new Map(graph.lodgings.map((lodging) => [lodging.id, lodging]));
    const days = [...graph.days].sort(
      (a, b) => a.order - b.order || a.date.localeCompare(b.date),
    );
    return {
      ...toSummary(graph.trip, days.length),
      days: days.map((day) => ({
        id: day.id,
        date: day.date,
        title: day.title,
        note: day.note,
        order: day.order,
        items: graph.timelineItems
          .filter((item) => item.dayId === day.id)
          .sort((a, b) => a.order - b.order)
          .flatMap((item) => {
            const entry = toEntry(item, placeById, lodgingById);
            return entry ? [entry] : [];
          }),
      })),
    };
  });
}

export async function readVersions(db: TravelDatabase, tripId: string) {
  return guard(async () => {
    const versions = await db.versions.where("tripId").equals(tripId).toArray();
    return versions
      .map((version) => {
        try {
          return parseVersion(version);
        } catch (error) {
          if (error instanceof ValidationError) throw new DataIntegrityError();
          throw error;
        }
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  });
}

export async function createTrip(db: TravelDatabase, input: unknown) {
  const parsed = parseTripInput(input);
  const now = Date.now();
  const trip = parseTrip({ ...parsed, id: createId(), createdAt: now, updatedAt: now });
  await guard(() =>
    db.transaction("rw", tables(db), async () => {
      await db.trips.add(trip);
      const snapshot = await readGraph(db, trip.id);
      if (snapshot) await writeVersion(db, trip.id, "创建行程", snapshot);
    }),
  );
  return trip;
}

export async function updateTrip(db: TravelDatabase, tripId: string, input: unknown) {
  const parsed: TripInput = parseTripInput(input);
  await guard(() =>
    withPriorVersion(db, tripId, "修改行程之前", async () => {
      const current = await db.trips.get(tripId);
      if (!current) throw new NotFoundError();
      await db.trips.put(
        parseTrip({
          ...current,
          ...parsed,
          updatedAt: Date.now(),
        }),
      );
    }),
  );
}

export async function deleteTrip(db: TravelDatabase, tripId: string) {
  const snapshot = await readGraph(db, tripId);
  if (!snapshot) throw new NotFoundError();
  await guard(() =>
    db.transaction("rw", tables(db), async () => {
      await db.timelineItems.where("tripId").equals(tripId).delete();
      await db.days.where("tripId").equals(tripId).delete();
      await db.places.where("tripId").equals(tripId).delete();
      await db.lodgings.where("tripId").equals(tripId).delete();
      await db.versions.where("tripId").equals(tripId).delete();
      await db.trips.delete(tripId);
    }),
  );
  return snapshot;
}

export async function restoreDeletedTrip(db: TravelDatabase, snapshot: unknown) {
  const parsed = parseSnapshot(snapshot);
  await guard(() =>
    db.transaction("rw", tables(db), async () => {
      await replaceGraph(db, parsed);
      await writeVersion(db, parsed.trip.id, "撤销删除行程", parsed);
    }),
  );
}

export async function createDay(db: TravelDatabase, tripId: string, input: unknown) {
  const parsed = parseDayInput(input);
  await guard(() =>
    withPriorVersion(db, tripId, "添加一天之前", async () => {
      const trip = await db.trips.get(tripId);
      if (!trip) throw new NotFoundError();
      await assertDayDateFree(db, tripId, parsed.date);
      const siblings = await db.days.where("tripId").equals(tripId).toArray();
      const order = siblings.reduce((max, day) => Math.max(max, day.order), -1) + 1;
      const now = Date.now();
      const day: Day = parseDay({
        ...parsed,
        id: createId(),
        tripId,
        order,
        createdAt: now,
        updatedAt: now,
      });
      await db.days.add(day);
      await touchTrip(db, tripId);
    }),
  );
}

export async function updateDay(db: TravelDatabase, dayId: string, input: unknown) {
  const parsed: DayInput = parseDayInput(input);
  const current = await db.days.get(dayId);
  if (!current) throw new NotFoundError();
  await guard(() =>
    withPriorVersion(db, current.tripId, "修改日期之前", async () => {
      const latest = await db.days.get(dayId);
      if (!latest) throw new NotFoundError();
      await assertDayDateFree(db, latest.tripId, parsed.date, dayId);
      await db.days.put(parseDay({ ...latest, ...parsed, updatedAt: Date.now() }));
      await touchTrip(db, latest.tripId);
    }),
  );
}

async function deleteUnreferenced(db: TravelDatabase, item: TimelineItem) {
  const remaining = await db.timelineItems
    .where("tripId")
    .equals(item.tripId)
    .filter((row) => row.refId === item.refId)
    .count();
  if (remaining > 0) return;
  if (item.kind === "place") await db.places.delete(item.refId);
  else await db.lodgings.delete(item.refId);
}

export async function deleteDay(db: TravelDatabase, dayId: string) {
  const day = await db.days.get(dayId);
  if (!day) throw new NotFoundError();
  const items = await db.timelineItems.where("dayId").equals(dayId).toArray();
  if (items.some((item) => item.locked)) {
    throw new LockedItemError("这一天里有锁定项目，不能删除。");
  }
  return guard(() =>
    withPriorVersion(db, day.tripId, "删除一天之前", async () => {
      for (const item of items) {
        await db.timelineItems.delete(item.id);
        await deleteUnreferenced(db, item);
      }
      await db.days.delete(dayId);
      await touchTrip(db, day.tripId);
    }),
  );
}

async function insertEntity(
  db: TravelDatabase,
  tripId: string,
  input: ItemInput,
  now: number,
) {
  const id = createId();
  if (input.kind === "place") {
    const place: Place = parsePlace({
      id,
      tripId,
      name: input.name,
      area: input.area,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    });
    await db.places.add(place);
    return id;
  }
  const lodging: Lodging = parseLodging({
    id,
    tripId,
    name: input.name,
    area: input.area,
    note: input.note,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    createdAt: now,
    updatedAt: now,
  });
  await db.lodgings.add(lodging);
  return id;
}

export async function createTimelineItem(
  db: TravelDatabase,
  dayId: string,
  input: unknown,
) {
  const parsed = parseItemInput(input);
  const day = await db.days.get(dayId);
  if (!day) throw new NotFoundError();
  await guard(() =>
    withPriorVersion(db, day.tripId, "添加项目之前", async () => {
      const now = Date.now();
      const refId = await insertEntity(db, day.tripId, parsed, now);
      const siblings = await db.timelineItems.where("dayId").equals(dayId).toArray();
      const order = siblings.reduce((max, item) => Math.max(max, item.order), -1) + 1;
      const item: TimelineItem = parseTimelineItem({
        id: createId(),
        tripId: day.tripId,
        dayId,
        kind: parsed.kind,
        refId,
        order,
        locked: false,
        timeLabel: parsed.timeLabel,
        createdAt: now,
        updatedAt: now,
      });
      await db.timelineItems.add(item);
      await touchTrip(db, day.tripId);
    }),
  );
}

export async function updateTimelineItem(
  db: TravelDatabase,
  itemId: string,
  input: unknown,
) {
  const parsed = parseItemInput(input);
  const item = requireItem(await db.timelineItems.get(itemId));
  if (item.locked) throw new LockedItemError();
  if (parsed.kind !== item.kind) {
    throw new ConflictError("不能把景点改成住宿，或把住宿改成景点。");
  }
  await guard(() =>
    withPriorVersion(db, item.tripId, "修改项目之前", async () => {
      const latest = requireItem(await db.timelineItems.get(itemId));
      if (latest.locked) throw new LockedItemError();
      const now = Date.now();
      if (latest.kind === "place") {
        const place = await db.places.get(latest.refId);
        if (!place) throw new NotFoundError();
        await db.places.put(
          parsePlace({
            ...place,
            name: parsed.name,
            area: parsed.area,
            note: parsed.note,
            updatedAt: now,
          }),
        );
      } else {
        const lodging = await db.lodgings.get(latest.refId);
        if (!lodging) throw new NotFoundError();
        await db.lodgings.put(
          parseLodging({
            ...lodging,
            name: parsed.name,
            area: parsed.area,
            note: parsed.note,
            checkIn: parsed.checkIn,
            checkOut: parsed.checkOut,
            updatedAt: now,
          }),
        );
      }
      await db.timelineItems.put(
        parseTimelineItem({ ...latest, timeLabel: parsed.timeLabel, updatedAt: now }),
      );
      await touchTrip(db, latest.tripId);
    }),
  );
}

export async function deleteTimelineItem(db: TravelDatabase, itemId: string) {
  const item = requireItem(await db.timelineItems.get(itemId));
  if (item.locked) throw new LockedItemError();
  return guard(() =>
    withPriorVersion(db, item.tripId, "删除项目之前", async () => {
      const latest = requireItem(await db.timelineItems.get(itemId));
      if (latest.locked) throw new LockedItemError();
      await db.timelineItems.delete(latest.id);
      await deleteUnreferenced(db, latest);
      await touchTrip(db, latest.tripId);
    }),
  );
}

export async function moveTimelineItem(
  db: TravelDatabase,
  itemId: string,
  direction: "up" | "down",
) {
  const item = requireItem(await db.timelineItems.get(itemId));
  if (item.locked) throw new LockedItemError();
  const siblings = (
    await db.timelineItems.where("dayId").equals(item.dayId).toArray()
  ).sort((a, b) => a.order - b.order);
  const index = siblings.findIndex((entry) => entry.id === itemId);
  const target = index + (direction === "up" ? -1 : 1);
  if (target < 0 || target >= siblings.length) return false;
  const neighbor = siblings[target];
  if (!neighbor) return false;
  if (neighbor.locked) {
    throw new LockedItemError("旁边这项已锁定，不能和它对调。");
  }
  await guard(() =>
    withPriorVersion(db, item.tripId, "调整顺序之前", async () => {
      const now = Date.now();
      await db.timelineItems.update(item.id, { order: neighbor.order, updatedAt: now });
      await db.timelineItems.update(neighbor.id, { order: item.order, updatedAt: now });
      await touchTrip(db, item.tripId);
    }),
  );
  return true;
}

export async function setTimelineLock(
  db: TravelDatabase,
  itemId: string,
  locked: boolean,
) {
  const item = requireItem(await db.timelineItems.get(itemId));
  if (item.locked === locked) return;
  await guard(() =>
    withPriorVersion(db, item.tripId, locked ? "锁定之前" : "解锁之前", async () => {
      const latest = requireItem(await db.timelineItems.get(itemId));
      await db.timelineItems.put(
        parseTimelineItem({ ...latest, locked, updatedAt: Date.now() }),
      );
      await touchTrip(db, latest.tripId);
    }),
  );
}

export async function saveGeneratedDraft(db: TravelDatabase, input: unknown) {
  const parsedResult = draftSchema.safeParse(input);
  if (!parsedResult.success) throw new ValidationError(parsedResult.error);
  const parsed = parsedResult.data;
  return guard(() =>
    db.transaction("rw", tables(db), async () => {
      const now = Date.now();
      const tripInput = parseTripInput({
        title: parsed.title,
        destination: parsed.destination,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        summary: parsed.summary,
      });
      const trip = parseTrip({
        ...tripInput,
        id: createId(),
        createdAt: now,
        updatedAt: now,
      });
      await db.trips.add(trip);
      for (const [dayIndex, day] of parsed.days.entries()) {
        const dayInput = parseDayInput({
          date: day.date,
          title: day.title,
          note: day.note,
        });
        const dayId = createId();
        await db.days.add(
          parseDay({
            ...dayInput,
            id: dayId,
            tripId: trip.id,
            order: dayIndex,
            createdAt: now,
            updatedAt: now,
          }),
        );
        for (const [itemIndex, item] of day.items.entries()) {
          const itemInput = parseItemInput(item);
          const refId = await insertEntity(db, trip.id, itemInput, now);
          await db.timelineItems.add(
            parseTimelineItem({
              id: createId(),
              tripId: trip.id,
              dayId,
              kind: itemInput.kind,
              refId,
              order: itemIndex,
              locked: false,
              timeLabel: itemInput.timeLabel,
              createdAt: now,
              updatedAt: now,
            }),
          );
        }
      }
      const snapshot = await readGraph(db, trip.id);
      if (snapshot) await writeVersion(db, trip.id, "保存 AI 草稿", snapshot);
      return trip.id;
    }),
  );
}

export async function attachMapMatch(
  db: TravelDatabase,
  kind: "place" | "lodging",
  refId: string,
  match: { poiId: string; name: string; address: string; lng: number; lat: number },
) {
  const now = Date.now();
  const patch = {
    name: match.name.slice(0, 40),
    mapSource: "amap" as const,
    amapPoiId: match.poiId,
    amapAddress: match.address.slice(0, 120),
    amapLng: match.lng,
    amapLat: match.lat,
    amapFetchedAt: now,
    updatedAt: now,
  };
  if (kind === "place") {
    const place = await db.places.get(refId);
    if (!place) throw new NotFoundError();
    await db.places.put(parsePlace({ ...place, ...patch }));
    return;
  }
  const lodging = await db.lodgings.get(refId);
  if (!lodging) throw new NotFoundError();
  await db.lodgings.put(parseLodging({ ...lodging, ...patch }));
}

export async function saveMapRoute(db: TravelDatabase, route: StoredRoute) {
  await db.mapRoutes.put(route);
}

export async function readMapRoutes(db: TravelDatabase, tripId: string) {
  return db.mapRoutes.where("tripId").equals(tripId).toArray();
}

export async function restoreVersion(db: TravelDatabase, versionId: string) {
  const version = await db.versions.get(versionId);
  if (!version) throw new NotFoundError();
  const parsed = parseVersion(version);
  const snapshot = parseSnapshot(parsed.snapshot);
  await guard(() =>
    db.transaction("rw", tables(db), async () => {
      const current = await readGraph(db, snapshot.trip.id);
      if (current) await writeVersion(db, snapshot.trip.id, "恢复前的行程", current);
      await replaceGraph(db, {
        ...snapshot,
        trip: { ...snapshot.trip, updatedAt: Date.now() },
      });
    }),
  );
}
