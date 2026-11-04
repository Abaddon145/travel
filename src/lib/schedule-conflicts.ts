import { presentRoute, type StoredRoute } from "@/lib/route-status";

export type ScheduleConflict = {
  dayId: string;
  fromId: string;
  toId: string;
  kind: "order" | "tight" | "unverified";
  message: string;
};

type TimedItem = {
  id: string;
  name: string;
  order: number;
  timeLabel: string;
};

function minutes(label: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(label);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function verifiedMinutes(routes: StoredRoute[], fromId: string, toId: string) {
  const verified = routes
    .filter((route) => route.fromItemId === fromId && route.toItemId === toId)
    .filter(
      (route) =>
        presentRoute(route, { fromPoiId: route.fromPoiId, toPoiId: route.toPoiId }).status === "verified" &&
        route.durationSeconds !== null,
    )
    .sort((a, b) => b.fetchedAt - a.fetchedAt);
  const chosen = verified[0];
  if (!chosen || chosen.durationSeconds === null) return null;
  return Math.max(1, Math.round(chosen.durationSeconds / 60));
}

export function findScheduleConflicts(
  days: { id: string; items: TimedItem[] }[],
  routes: StoredRoute[],
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  for (const day of days) {
    const timed = [...day.items]
      .filter((item) => minutes(item.timeLabel) !== null)
      .sort((a, b) => a.order - b.order);
    for (let index = 1; index < timed.length; index += 1) {
      const previous = timed[index - 1];
      const next = timed[index];
      if (!previous || !next) continue;
      const earlier = minutes(previous.timeLabel);
      const later = minutes(next.timeLabel);
      if (earlier === null || later === null) continue;
      if (later < earlier) {
        conflicts.push({
          dayId: day.id,
          fromId: previous.id,
          toId: next.id,
          kind: "order",
          message: `${next.name} 排在 ${previous.name} 后面，但时间更早。`,
        });
        continue;
      }
      const needed = verifiedMinutes(routes, previous.id, next.id);
      if (needed === null) {
        conflicts.push({
          dayId: day.id,
          fromId: previous.id,
          toId: next.id,
          kind: "unverified",
          message: `${previous.name} 到 ${next.name} 还没核实，不判断是否来得及。`,
        });
        continue;
      }
      const gap = later - earlier;
      if (gap < needed) {
        conflicts.push({
          dayId: day.id,
          fromId: previous.id,
          toId: next.id,
          kind: "tight",
          message: `${previous.name} 到 ${next.name} 只隔 ${gap} 分钟，已核实路线需要 ${needed} 分钟。`,
        });
      }
    }
  }
  return conflicts;
}
