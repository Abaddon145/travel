import { z } from "zod";

export const AI_MODELS = ["deepseek-flash", "deepseek-v4-pro"] as const;
export type AiModel = (typeof AI_MODELS)[number];

export const DEFAULT_AI_MODEL: AiModel = "deepseek-flash";
export const MAX_TRIP_DAYS = 14;
export const MAX_ITEMS_PER_DAY = 8;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期");

export function inclusiveDays(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

export function eachDate(start: string, end: string) {
  const count = Math.max(0, inclusiveDays(start, end));
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  for (let index = 0; index < count; index += 1) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function shanghaiDay(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export const preferenceSchema = z
  .object({
    destination: z.string().trim().min(1, "请填写目的地").max(40, "目的地请控制在 40 个字以内"),
    startDate: isoDate,
    endDate: isoDate,
    travelers: z.number().int().min(1, "至少 1 人").max(12, "最多 12 人"),
    budget: z.enum(["low", "medium", "high"]),
    pace: z.enum(["relaxed", "moderate", "packed"]),
    interests: z
      .array(z.string().trim().min(1).max(20, "每个兴趣请控制在 20 个字以内"))
      .max(8, "兴趣最多 8 个"),
    notes: z.string().trim().max(400, "备注请控制在 400 个字以内"),
    model: z.enum(AI_MODELS).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "结束日期不能早于开始日期",
      });
      return;
    }
    const span = inclusiveDays(value.startDate, value.endDate);
    if (span < 1 || span > MAX_TRIP_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: `行程请控制在 ${MAX_TRIP_DAYS} 天以内`,
      });
    }
  });

export type TravelPreference = z.infer<typeof preferenceSchema>;

const clock = z
  .string()
  .trim()
  .transform((value) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return value;
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  })
  .refine((value) => value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), {
    message: "时间请写成 09:30 这样的形式",
  });

const draftItemSchema = z.object({
  kind: z.enum(["place", "lodging"]),
  name: z.string().trim().min(1, "请填写名称").max(40, "名称请控制在 40 个字以内"),
  area: z.string().trim().max(40, "区域请控制在 40 个字以内").default(""),
  note: z.string().trim().max(200, "备注请控制在 200 个字以内").default(""),
  timeLabel: clock.default(""),
  checkIn: z.string().trim().default(""),
  checkOut: z.string().trim().default(""),
});

export const draftSchema = z
  .object({
    title: z.string().trim().min(1, "请填写标题").max(40, "标题请控制在 40 个字以内"),
    destination: z.string().trim().min(1).max(40),
    startDate: isoDate,
    endDate: isoDate,
    summary: z.string().trim().max(200, "简介请控制在 200 个字以内").default(""),
    warnings: z.array(z.string().trim().min(1).max(80)).max(6).default([]),
    days: z.array(
      z.object({
        date: isoDate,
        title: z.string().trim().min(1, "请填写这一天的标题").max(40),
        note: z.string().trim().max(200).default(""),
        items: z.array(draftItemSchema).min(1, "这一天至少安排一项").max(MAX_ITEMS_PER_DAY),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    const expected = eachDate(value.startDate, value.endDate);
    const actual = value.days.map((day) => day.date);
    if (expected.length === 0 || actual.join() !== expected.join()) {
      ctx.addIssue({
        code: "custom",
        path: ["days"],
        message: "每一天都要按开始到结束的日期各出现一次",
      });
    }
  });

export type TravelDraft = z.infer<typeof draftSchema>;

export function issueList(error: z.ZodError) {
  return error.issues.slice(0, 8).map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function splitInterests(value: string) {
  return value
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}
