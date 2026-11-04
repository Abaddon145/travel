import { z } from "zod";
import type {
  Day,
  Lodging,
  Place,
  TimelineItem,
  Trip,
  TripSnapshot,
  TripVersion,
} from "@/domain/types";
import { parseIsoDate } from "@/lib/dates";
import { ValidationError } from "@/db/errors";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期")
  .refine((value) => parseIsoDate(value) !== null, "请选择有效日期");

const optionalDate = z
  .string()
  .refine((value) => value === "" || parseIsoDate(value) !== null, {
    message: "请选择有效日期",
  });

const timeLabel = z
  .string()
  .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, "时间请写成 09:30 这样的形式");

const stamp = {
  id: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
};

function datesInOrder(
  value: { startDate: string; endDate: string },
  ctx: z.RefinementCtx,
) {
  if (value.endDate < value.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "结束日期不能早于开始日期",
    });
  }
}

const tripFields = {
  title: z.string().trim().min(1, "请填写标题").max(40, "标题请控制在 40 个字以内"),
  destination: z
    .string()
    .trim()
    .min(1, "请填写目的地")
    .max(40, "目的地请控制在 40 个字以内"),
  startDate: isoDate,
  endDate: isoDate,
  summary: z.string().trim().max(200, "简介请控制在 200 个字以内"),
};

export const tripInputSchema = z.object(tripFields).superRefine(datesInOrder);

export const tripSchema = z.object({ ...tripFields, ...stamp }).superRefine(datesInOrder);

const dayFields = {
  tripId: z.string().min(1),
  date: isoDate,
  title: z
    .string()
    .trim()
    .min(1, "请填写这一天的标题")
    .max(40, "标题请控制在 40 个字以内"),
  note: z.string().trim().max(200, "备注请控制在 200 个字以内"),
  order: z.number().int(),
};

export const dayInputSchema = z.object({
  date: dayFields.date,
  title: dayFields.title,
  note: dayFields.note,
});

export const daySchema = z.object({ ...dayFields, ...stamp });

const mapFields = {
  mapSource: z.enum(["amap", "unverified"]).default("unverified"),
  amapPoiId: z.string().max(40).default(""),
  amapAddress: z.string().max(120).default(""),
  amapLng: z.number().finite().nullable().default(null),
  amapLat: z.number().finite().nullable().default(null),
  amapFetchedAt: z.number().int().nullable().default(null),
};

const placeFields = {
  tripId: z.string().min(1),
  name: z.string().trim().min(1, "请填写名称").max(40, "名称请控制在 40 个字以内"),
  area: z.string().trim().max(40, "区域请控制在 40 个字以内"),
  note: z.string().trim().max(200, "备注请控制在 200 个字以内"),
};

export const placeSchema = z.object({ ...placeFields, ...stamp, ...mapFields });

const lodgingFields = {
  ...placeFields,
  checkIn: optionalDate,
  checkOut: optionalDate,
};

export const lodgingSchema = z.object(lodgingFields).extend(stamp).extend(mapFields);

export const itemInputSchema = z.object({
  kind: z.enum(["place", "lodging"]),
  name: placeFields.name,
  area: placeFields.area,
  note: placeFields.note,
  timeLabel,
  checkIn: optionalDate,
  checkOut: optionalDate,
});

export const timelineItemSchema = z.object({
  tripId: z.string().min(1),
  dayId: z.string().min(1),
  kind: z.enum(["place", "lodging"]),
  refId: z.string().min(1),
  order: z.number().int(),
  locked: z.boolean(),
  timeLabel,
  ...stamp,
});

export const tripSnapshotSchema = z.object({
  trip: tripSchema,
  days: z.array(daySchema),
  places: z.array(placeSchema),
  lodgings: z.array(lodgingSchema),
  timelineItems: z.array(timelineItemSchema),
});

export const tripVersionSchema = z.object({
  id: z.string().min(1),
  tripId: z.string().min(1),
  label: z.string().min(1),
  createdAt: z.number(),
  snapshot: tripSnapshotSchema,
});

export type TripInput = z.infer<typeof tripInputSchema>;
export type DayInput = z.infer<typeof dayInputSchema>;
export type ItemInput = z.infer<typeof itemInputSchema>;

export function fieldErrors(error: z.ZodError) {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !map[key]) map[key] = issue.message;
  }
  return map;
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export const parseTripInput = (value: unknown) => parseOrThrow(tripInputSchema, value);
export const parseDayInput = (value: unknown) => parseOrThrow(dayInputSchema, value);
export const parseItemInput = (value: unknown) => parseOrThrow(itemInputSchema, value);
export const parseTrip = (value: unknown): Trip => parseOrThrow(tripSchema, value);
export const parseDay = (value: unknown): Day => parseOrThrow(daySchema, value);
export const parsePlace = (value: unknown): Place => parseOrThrow(placeSchema, value);
export const parseLodging = (value: unknown): Lodging =>
  parseOrThrow(lodgingSchema, value);
export const parseTimelineItem = (value: unknown): TimelineItem =>
  parseOrThrow(timelineItemSchema, value);
export const parseSnapshot = (value: unknown): TripSnapshot =>
  parseOrThrow(tripSnapshotSchema, value);
export const parseVersion = (value: unknown): TripVersion =>
  parseOrThrow(tripVersionSchema, value);
