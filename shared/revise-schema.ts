import { z } from "zod";

const clock = z
  .string()
  .trim()
  .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, "时间请写成 09:30 这样的形式");

const id = z.string().trim().min(1).max(80);

export const patchOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    dayId: id,
    kind: z.enum(["place", "lodging"]),
    name: z.string().trim().min(1).max(40),
    area: z.string().trim().max(40).default(""),
    note: z.string().trim().max(200).default(""),
    timeLabel: clock.default(""),
    order: z.number().int().min(0).max(40),
  }),
  z.object({
    op: z.literal("remove"),
    itemId: id,
  }),
  z.object({
    op: z.literal("move"),
    itemId: id,
    dayId: id,
    order: z.number().int().min(0).max(40),
  }),
  z.object({
    op: z.literal("update"),
    itemId: id,
    name: z.string().trim().min(1).max(40).optional(),
    area: z.string().trim().max(40).optional(),
    note: z.string().trim().max(200).optional(),
    timeLabel: clock.optional(),
  }),
]);

export type PatchOp = z.infer<typeof patchOpSchema>;

export const assistantReplySchema = z.object({
  message: z.string().trim().min(1).max(400),
  ops: z.array(patchOpSchema).max(12),
});

const historyTurn = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(400),
});

const tripItem = z.object({
  id,
  name: z.string().trim().min(1).max(40),
  area: z.string().trim().max(40).default(""),
  note: z.string().trim().max(200).default(""),
  timeLabel: clock.default(""),
  locked: z.boolean(),
  order: z.number().int(),
  kind: z.enum(["place", "lodging"]),
});

const tripDay = z.object({
  id,
  title: z.string().trim().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  locked: z.boolean().default(false),
  lockedFrom: clock.default(""),
  lockedTo: clock.default(""),
  items: z.array(tripItem).max(12),
});

export const reviseRequestSchema = z.object({
  instruction: z.string().trim().min(1).max(200),
  model: z.enum(["deepseek-flash", "deepseek-v4-pro"]).optional(),
  scope: z.object({
    dayId: z.string().trim().max(80).default(""),
    itemIds: z.array(id).max(8).default([]),
  }),
  history: z.array(historyTurn).max(8).default([]),
  trip: z.object({
    title: z.string().trim().min(1).max(40),
    destination: z.string().trim().min(1).max(40),
    days: z.array(tripDay).min(1).max(14),
  }),
});

export type ReviseRequest = z.infer<typeof reviseRequestSchema>;

export type LockDay = {
  id: string;
  locked: boolean;
  lockedFrom: string;
  lockedTo: string;
};

export type LockItem = {
  id: string;
  dayId: string;
  timeLabel: string;
  locked: boolean;
};

export function inLockedWindow(day: LockDay, timeLabel: string) {
  if (!day.lockedFrom || !day.lockedTo || !timeLabel) return false;
  const start = day.lockedFrom <= day.lockedTo ? day.lockedFrom : day.lockedTo;
  const end = day.lockedFrom <= day.lockedTo ? day.lockedTo : day.lockedFrom;
  return timeLabel >= start && timeLabel <= end;
}

export function isItemLocked(days: LockDay[], item: LockItem) {
  if (item.locked) return true;
  const day = days.find((entry) => entry.id === item.dayId);
  if (!day) return true;
  if (day.locked) return true;
  return inLockedWindow(day, item.timeLabel);
}

export function splitLockedOps(input: { days: LockDay[]; items: LockItem[] }, ops: PatchOp[]) {
  const kept: PatchOp[] = [];
  const rejected: PatchOp[] = [];
  for (const op of ops) {
    if (op.op === "add") {
      const day = input.days.find((entry) => entry.id === op.dayId);
      if (!day || day.locked || inLockedWindow(day, op.timeLabel)) rejected.push(op);
      else kept.push(op);
      continue;
    }
    const item = input.items.find((entry) => entry.id === op.itemId);
    if (!item || isItemLocked(input.days, item)) {
      rejected.push(op);
      continue;
    }
    if (op.op === "move") {
      const day = input.days.find((entry) => entry.id === op.dayId);
      if (!day || day.locked) {
        rejected.push(op);
        continue;
      }
    }
    if (op.op === "update" && op.timeLabel) {
      const day = input.days.find((entry) => entry.id === item.dayId);
      if (day && inLockedWindow(day, op.timeLabel)) {
        rejected.push(op);
        continue;
      }
    }
    kept.push(op);
  }
  return { kept, rejected };
}
