import { z } from "zod";
import type { AiUsageEntry } from "@/db/ai-usage";
import type { TravelDatabase } from "@/db/database";
import { BackupError } from "@/db/errors";
import {
  bookingSchema,
  checklistSchema,
  favoriteSchema,
  ledgerSchema,
  noteSchema,
} from "@/db/tool-validation";
import {
  daySchema,
  lodgingSchema,
  placeSchema,
  timelineItemSchema,
  tripSchema,
  tripVersionSchema,
} from "@/db/validation";
import type {
  Booking,
  ChecklistItem,
  Day,
  Favorite,
  LedgerEntry,
  Lodging,
  Place,
  TimelineItem,
  TravelNote,
  Trip,
  TripVersion,
} from "@/domain/types";
import type { RoutePick, StoredRoute } from "@/lib/route-status";

export const BACKUP_SCHEMA_VERSION = 7;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export const BACKUP_TABLES = [
  "trips",
  "days",
  "places",
  "lodgings",
  "timelineItems",
  "versions",
  "aiUsage",
  "mapRoutes",
  "routePicks",
  "ledgerEntries",
  "bookings",
  "checklistItems",
  "favorites",
  "travelNotes",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export const backupTableLabel: Record<BackupTable, string> = {
  trips: "行程",
  days: "日期",
  places: "景点",
  lodgings: "住宿点",
  timelineItems: "时间线",
  versions: "版本",
  aiUsage: "生成记录",
  mapRoutes: "路线",
  routePicks: "路线选择",
  ledgerEntries: "账目",
  bookings: "预订",
  checklistItems: "清单",
  favorites: "收藏",
  travelNotes: "备注",
};

export type BackupTables = {
  trips: Trip[];
  days: Day[];
  places: Place[];
  lodgings: Lodging[];
  timelineItems: TimelineItem[];
  versions: TripVersion[];
  aiUsage: AiUsageEntry[];
  mapRoutes: StoredRoute[];
  routePicks: RoutePick[];
  ledgerEntries: LedgerEntry[];
  bookings: Booking[];
  checklistItems: ChecklistItem[];
  favorites: Favorite[];
  travelNotes: TravelNote[];
};

export type BackupFile = {
  format: "lvxu-backup";
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  app: "lvxu-travel";
  tables: BackupTables;
};

export type BackupData = {
  schemaVersion: number;
  exportedAt: string | null;
  migratedFrom: number | null;
  tables: BackupTables;
};

export type ImportPreview = {
  schemaVersion: number;
  migratedFrom: number | null;
  exportedAt: string | null;
  counts: Record<BackupTable, number>;
  merge: { insert: number; update: number; keepLocal: number };
  replace: { removeLocal: number; write: number };
};

export type ImportMode = "merge" | "replace";

const aiUsageSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number(),
  destination: z.string().max(80),
  model: z.enum(["deepseek-flash", "deepseek-v4-pro"]),
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  cacheHitTokens: z.number().int().nonnegative().default(0),
  cacheMissTokens: z.number().int().nonnegative().default(0),
  latencyMs: z.number().int().nonnegative().default(0),
  attempts: z.number().int().positive().default(1),
});

const mapRouteSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  fromItemId: z.string().min(1),
  toItemId: z.string().min(1),
  mode: z.enum(["walking", "driving", "transit"]),
  ok: z.boolean(),
  distanceMeters: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  polyline: z.string(),
  fetchedAt: z.number(),
  fromPoiId: z.string().default(""),
  toPoiId: z.string().default(""),
});

const routePickSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  fromItemId: z.string().min(1),
  toItemId: z.string().min(1),
  mode: z.enum(["walking", "driving", "transit"]),
});

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stampOf(row: object) {
  const value = row as { updatedAt?: unknown; fetchedAt?: unknown; createdAt?: unknown };
  if (typeof value.updatedAt === "number") return value.updatedAt;
  if (typeof value.fetchedAt === "number") return value.fetchedAt;
  if (typeof value.createdAt === "number") return value.createdAt;
  return 0;
}

export function assertBackupSize(bytes: number) {
  if (bytes > MAX_BACKUP_BYTES) {
    throw new BackupError("备份文件过大，没有读取。请确认这是旅序导出的 JSON。");
  }
}

function parseRows<T extends { id: string }>(
  table: BackupTable,
  rows: unknown,
  schema: z.ZodType<T>,
): T[] {
  const label = backupTableLabel[table];
  if (rows == null) return [];
  if (!Array.isArray(rows)) throw new BackupError(`${label}不是列表。`);
  const parsed = rows.map((row, index) => {
    const result = schema.safeParse(row);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "格式不正确";
      throw new BackupError(`${label}第 ${index + 1} 条无法导入：${message}`);
    }
    return result.data;
  });
  const seen = new Set<string>();
  for (const row of parsed) {
    if (seen.has(row.id)) throw new BackupError(`${label}里有重复的记录。`);
    seen.add(row.id);
  }
  return parsed;
}

function normalizeTrips(rows: unknown) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    if (!isRecord(row)) return row;
    if (typeof row.title === "string" || typeof row.name !== "string") return row;
    const { name, ...rest } = row;
    return { ...rest, title: name };
  });
}

function inferVersion(source: Record<string, unknown>) {
  if ("itinerary" in source && !("days" in source)) return 1;
  if ("ledgerEntries" in source) return 7;
  if ("routePicks" in source) return 6;
  if ("mapRoutes" in source) return 5;
  if ("aiUsage" in source) return 4;
  if ("days" in source || "places" in source || "lodgings" in source) return 3;
  if ("trips" in source) return 2;
  return 0;
}

function resolveVersion(value: unknown, source: Record<string, unknown>) {
  if (value == null) {
    const inferred = inferVersion(source);
    if (inferred === 0) throw new BackupError("这份文件不是旅序备份。");
    return inferred;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new BackupError("这份文件不是旅序备份。");
  }
  return value;
}

function readItinerary(source: Record<string, unknown>): LegacyItinerary[] {
  const rows = source.itinerary;
  if (rows == null) return [];
  if (!Array.isArray(rows)) throw new BackupError("旧行程不是列表。");
  return rows.map((row, index) => {
    if (!isRecord(row)) throw new BackupError(`旧行程第 ${index + 1} 条无法导入。`);
    const kind = row.kind === "lodging" ? "lodging" : row.kind === "place" ? "place" : null;
    if (
      typeof row.id !== "string" ||
      typeof row.tripId !== "string" ||
      typeof row.dayDate !== "string" ||
      typeof row.name !== "string" ||
      typeof row.order !== "number" ||
      !kind
    ) {
      throw new BackupError(`旧行程第 ${index + 1} 条无法导入。`);
    }
    return {
      id: row.id,
      tripId: row.tripId,
      dayDate: row.dayDate,
      dayTitle: typeof row.dayTitle === "string" ? row.dayTitle : undefined,
      dayNote: typeof row.dayNote === "string" ? row.dayNote : undefined,
      order: row.order,
      kind,
      name: row.name,
      area: typeof row.area === "string" ? row.area : undefined,
      note: typeof row.note === "string" ? row.note : undefined,
      timeLabel: typeof row.timeLabel === "string" ? row.timeLabel : undefined,
      locked: row.locked === true,
      checkIn: typeof row.checkIn === "string" ? row.checkIn : undefined,
      checkOut: typeof row.checkOut === "string" ? row.checkOut : undefined,
    };
  });
}

function splitLegacy(source: Record<string, unknown>, now: number) {
  const rawTrips = Array.isArray(source.trips) ? source.trips : [];
  const tripStamp = new Map<string, number>();
  for (const trip of rawTrips) {
    if (!isRecord(trip) || typeof trip.id !== "string") continue;
    const stamp = typeof trip.updatedAt === "number" ? trip.updatedAt : now;
    tripStamp.set(trip.id, stamp);
  }
  const rows = readItinerary(source);
  const groups = new Map<
    string,
    { tripId: string; dayDate: string; dayTitle: string; dayNote: string; rows: LegacyItinerary[] }
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
  const days: unknown[] = [];
  const places: unknown[] = [];
  const lodgings: unknown[] = [];
  const timelineItems: unknown[] = [];
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
    const stamp = tripStamp.get(group.tripId) ?? now;
    const dayId = `day-${group.tripId}-${group.dayDate}`;
    days.push({
      id: dayId,
      tripId: group.tripId,
      date: group.dayDate,
      title: group.dayTitle,
      note: group.dayNote,
      order: dayOrder,
      createdAt: stamp,
      updatedAt: stamp,
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
        createdAt: stamp,
        updatedAt: stamp,
      };
      if (row.kind === "lodging") {
        lodgings.push({
          ...shared,
          checkIn: row.checkIn ?? "",
          checkOut: row.checkOut ?? "",
        });
      } else {
        places.push(shared);
      }
      timelineItems.push({
        id: row.id,
        tripId: row.tripId,
        dayId,
        kind: row.kind,
        refId,
        order: index,
        locked: row.locked === true,
        timeLabel: row.timeLabel ?? "",
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
  }
  return { days, places, lodgings, timelineItems };
}

function tablesFrom(source: Record<string, unknown>, legacy: boolean, now: number): BackupTables {
  const split = legacy ? splitLegacy(source, now) : null;
  const trips = parseRows("trips", normalizeTrips(source.trips), tripSchema);
  const days = parseRows("days", split?.days ?? source.days, daySchema);
  const places = parseRows("places", split?.places ?? source.places, placeSchema);
  const lodgings = parseRows("lodgings", split?.lodgings ?? source.lodgings, lodgingSchema);
  const timelineItems = parseRows(
    "timelineItems",
    split?.timelineItems ?? source.timelineItems,
    timelineItemSchema,
  );
  const versions = parseRows("versions", legacy ? [] : source.versions, tripVersionSchema);
  const aiUsage = parseRows("aiUsage", legacy ? [] : source.aiUsage, aiUsageSchema);
  const mapRoutes = parseRows("mapRoutes", legacy ? [] : source.mapRoutes, mapRouteSchema);
  const routePicks = parseRows("routePicks", legacy ? [] : source.routePicks, routePickSchema);
  const ledgerEntries = parseRows(
    "ledgerEntries",
    legacy ? [] : source.ledgerEntries,
    ledgerSchema,
  );
  const bookings = parseRows("bookings", legacy ? [] : source.bookings, bookingSchema);
  const checklistItems = parseRows(
    "checklistItems",
    legacy ? [] : source.checklistItems,
    checklistSchema,
  );
  const favorites = parseRows("favorites", legacy ? [] : source.favorites, favoriteSchema);
  const travelNotes = parseRows("travelNotes", legacy ? [] : source.travelNotes, noteSchema);
  return {
    trips,
    days,
    places,
    lodgings,
    timelineItems,
    versions,
    aiUsage,
    mapRoutes,
    routePicks,
    ledgerEntries,
    bookings,
    checklistItems,
    favorites,
    travelNotes,
  };
}

export function parseBackup(input: unknown, now = Date.now()): BackupData {
  if (!isRecord(input)) throw new BackupError("这份文件不是旅序备份。");
  if (input.format != null && input.format !== "lvxu-backup") {
    throw new BackupError("这份文件不是旅序备份。");
  }
  if (input.app != null && input.app !== "lvxu-travel") {
    throw new BackupError("这份文件不是旅序备份。");
  }
  const source = input.format === "lvxu-backup" ? input.tables : input;
  if (!isRecord(source)) throw new BackupError("这份文件不是旅序备份。");
  const schemaVersion = resolveVersion(input.schemaVersion, source);
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError("这份备份来自更新的旅序，当前版本无法导入。");
  }
  const hasItinerary = Array.isArray(source.itinerary);
  const hasDays = Array.isArray(source.days);
  if (hasItinerary && hasDays) {
    throw new BackupError("这份备份同时包含旧行程和新行程，无法判断以哪一份为准。");
  }
  const legacy = hasItinerary || (schemaVersion === 1 && !hasDays);
  const exportedAt = typeof input.exportedAt === "string" ? input.exportedAt : null;
  return {
    schemaVersion,
    exportedAt,
    migratedFrom: schemaVersion < BACKUP_SCHEMA_VERSION ? schemaVersion : null,
    tables: tablesFrom(source, legacy, now),
  };
}

export async function exportBackup(
  db: TravelDatabase,
  now = new Date(),
): Promise<BackupFile> {
  const raw: Record<string, unknown> = {};
  for (const name of BACKUP_TABLES) {
    raw[name] = await db.table(name).toArray();
  }
  const tables = tablesFrom(raw, false, now.getTime());
  for (const name of BACKUP_TABLES) {
    (tables[name] as { id: string }[]).sort((a, b) => a.id.localeCompare(b.id));
  }
  return {
    format: "lvxu-backup",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    app: "lvxu-travel",
    tables,
  };
}

function countsOf(tables: BackupTables): Record<BackupTable, number> {
  const counts = {} as Record<BackupTable, number>;
  for (const name of BACKUP_TABLES) counts[name] = tables[name].length;
  return counts;
}

export async function previewImport(
  db: TravelDatabase,
  input: unknown,
  now = Date.now(),
): Promise<{ data: BackupData; preview: ImportPreview }> {
  const data = parseBackup(input, now);
  const merge = { insert: 0, update: 0, keepLocal: 0 };
  let removeLocal = 0;
  let write = 0;
  for (const name of BACKUP_TABLES) {
    const incoming = data.tables[name] as { id: string }[];
    write += incoming.length;
    const existing = (await db.table(name).toArray()) as { id: string }[];
    removeLocal += existing.length;
    const byId = new Map(existing.map((row) => [row.id, row]));
    const incomingIds = new Set(incoming.map((row) => row.id));
    for (const row of existing) {
      if (!incomingIds.has(row.id)) merge.keepLocal += 1;
    }
    for (const row of incoming) {
      const current = byId.get(row.id);
      if (!current) merge.insert += 1;
      else if (stampOf(row) >= stampOf(current)) merge.update += 1;
      else merge.keepLocal += 1;
    }
  }
  return {
    data,
    preview: {
      schemaVersion: data.schemaVersion,
      migratedFrom: data.migratedFrom,
      exportedAt: data.exportedAt,
      counts: countsOf(data.tables),
      merge,
      replace: { removeLocal, write },
    },
  };
}

export async function applyImport(
  db: TravelDatabase,
  data: BackupData,
  mode: ImportMode,
  options?: { beforeFinish?: () => void },
) {
  const tables = BACKUP_TABLES.map((name) => db.table(name));
  try {
    await db.transaction("rw", tables, async () => {
      if (mode === "replace") {
        for (const name of BACKUP_TABLES) await db.table(name).clear();
      }
      for (const name of BACKUP_TABLES) {
        const incoming = data.tables[name] as { id: string }[];
        let writes = incoming;
        if (mode === "merge") {
          const existing = (await db.table(name).toArray()) as { id: string }[];
          const byId = new Map(existing.map((row) => [row.id, row]));
          writes = incoming.filter((row) => {
            const current = byId.get(row.id);
            return !current || stampOf(row) >= stampOf(current);
          });
        }
        if (writes.length > 0) await db.table(name).bulkPut(writes);
      }
      options?.beforeFinish?.();
    });
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError("写入没有完成，这台设备上的数据保持原样。");
  }
}

export function downloadBackup(file: BackupFile) {
  const date = file.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lvxu-backup-${date || "export"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
