import { z } from "zod";
import { categoryOrder, currencyCodes, MAX_MINOR } from "@/domain/money";
import type {
  Booking,
  ChecklistItem,
  Favorite,
  LedgerEntry,
  TravelNote,
  TripTools,
} from "@/domain/types";
import { parseIsoDate } from "@/lib/dates";
import { ValidationError } from "@/db/errors";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期")
  .refine((value) => parseIsoDate(value) !== null, "请选择有效日期");

const optionalDate = z.string().refine((value) => value === "" || parseIsoDate(value) !== null, {
  message: "请选择有效日期",
});

const minor = z.number().int().nonnegative().max(MAX_MINOR, "金额过大");

const stamp = {
  id: z.string().min(1),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
};

const title40 = z.string().trim().min(1, "请填写名称").max(40, "名称请控制在 40 个字以内");

export const ledgerInputSchema = z
  .object({
    date: optionalDate,
    category: z.enum(categoryOrder),
    title: title40,
    note: z.string().trim().max(200, "备注请控制在 200 个字以内"),
    currency: z.enum(currencyCodes),
    plannedMinor: minor,
    actualMinor: minor.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.plannedMinor === 0 && value.actualMinor === null) {
      ctx.addIssue({
        code: "custom",
        path: ["plannedMinor"],
        message: "请填写预计或实际",
      });
    }
  });

export const ledgerSchema = ledgerInputSchema.extend(stamp).extend({
  tripId: z.string().min(1),
});

export const bookingInputSchema = z
  .object({
    kind: z.enum(["lodging", "train", "reservation"]),
    title: title40,
    date: isoDate,
    endDate: optionalDate,
    reference: z.string().trim().max(40, "编号请控制在 40 个字以内"),
    detail: z.string().trim().max(120, "详情请控制在 120 个字以内"),
    note: z.string().trim().max(200, "备注请控制在 200 个字以内"),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.endDate < value.date) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "结束日期不能早于开始日期",
      });
    }
  });

export const bookingSchema = bookingInputSchema.extend(stamp).extend({
  tripId: z.string().min(1),
});

export const checklistInputSchema = z.object({
  title: z.string().trim().min(1, "请填写事项").max(80, "事项请控制在 80 个字以内"),
  note: z.string().trim().max(200, "备注请控制在 200 个字以内"),
  done: z.boolean(),
});

export const checklistSchema = checklistInputSchema.extend(stamp).extend({
  tripId: z.string().min(1),
  order: z.number().int().nonnegative(),
});

export const favoriteInputSchema = z.object({
  title: z.string().trim().min(1, "请填写名称").max(80, "名称请控制在 80 个字以内"),
  note: z.string().trim().max(400, "备注请控制在 400 个字以内"),
});

export const favoriteSchema = favoriteInputSchema.extend(stamp).extend({
  tripId: z.string().min(1),
});

export const noteInputSchema = z.object({
  title: title40,
  body: z.string().trim().min(1, "请填写正文").max(1000, "正文请控制在 1000 个字以内"),
  date: optionalDate,
});

export const noteSchema = noteInputSchema.extend(stamp).extend({
  tripId: z.string().min(1),
});

export const tripToolsSchema = z.object({
  ledgerEntries: z.array(ledgerSchema),
  bookings: z.array(bookingSchema),
  checklistItems: z.array(checklistSchema),
  favorites: z.array(favoriteSchema),
  travelNotes: z.array(noteSchema),
});

export type LedgerInput = z.infer<typeof ledgerInputSchema>;
export type BookingInput = z.infer<typeof bookingInputSchema>;
export type ChecklistInput = z.infer<typeof checklistInputSchema>;
export type FavoriteInput = z.infer<typeof favoriteInputSchema>;
export type NoteInput = z.infer<typeof noteInputSchema>;

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export const parseLedgerInput = (value: unknown) => parseOrThrow(ledgerInputSchema, value);
export const parseLedger = (value: unknown): LedgerEntry => parseOrThrow(ledgerSchema, value);
export const parseBookingInput = (value: unknown) => parseOrThrow(bookingInputSchema, value);
export const parseBooking = (value: unknown): Booking => parseOrThrow(bookingSchema, value);
export const parseChecklistInput = (value: unknown) => parseOrThrow(checklistInputSchema, value);
export const parseChecklist = (value: unknown): ChecklistItem =>
  parseOrThrow(checklistSchema, value);
export const parseFavoriteInput = (value: unknown) => parseOrThrow(favoriteInputSchema, value);
export const parseFavorite = (value: unknown): Favorite => parseOrThrow(favoriteSchema, value);
export const parseNoteInput = (value: unknown) => parseOrThrow(noteInputSchema, value);
export const parseTravelNote = (value: unknown): TravelNote => parseOrThrow(noteSchema, value);

export function parseTripTools(value: unknown): TripTools {
  if (value == null) {
    return {
      ledgerEntries: [],
      bookings: [],
      checklistItems: [],
      favorites: [],
      travelNotes: [],
    };
  }
  return parseOrThrow(tripToolsSchema, value);
}
