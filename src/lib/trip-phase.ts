import type { DayView, TimelineEntry, TripDetail, TripSummary } from "@/domain/types";
import { parseIsoDate } from "@/lib/dates";

export type TripPhase = "upcoming" | "active" | "past";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayNumber(iso: string, today: Date) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  const ms = startOfDay(today).getTime() - startOfDay(parsed).getTime();
  return Math.round(ms / 86_400_000);
}

export function tripPhase(
  trip: Pick<TripSummary, "startDate" | "endDate">,
  today = new Date(),
): TripPhase {
  const untilStart = dayNumber(trip.startDate, today);
  const untilEnd = dayNumber(trip.endDate, today);
  if (untilStart === null || untilEnd === null) return "upcoming";
  if (untilStart < 0) return "upcoming";
  if (untilEnd > 0) return "past";
  return "active";
}

export function tripStatusLabel(
  trip: Pick<TripSummary, "startDate" | "endDate" | "dayCount">,
  today = new Date(),
) {
  const phase = tripPhase(trip, today);
  const untilStart = dayNumber(trip.startDate, today);
  if (phase === "upcoming") {
    const days = untilStart === null ? null : -untilStart;
    if (days === 0) return "今天出发";
    if (days === 1) return "明天出发";
    return days === null ? "即将出发" : `还有 ${days} 天`;
  }
  if (phase === "past") return "已结束";
  const index = untilStart === null ? 1 : untilStart + 1;
  const total = trip.dayCount > 0 ? trip.dayCount : index;
  return `第 ${index} 天 · 共 ${total} 天`;
}

export function pickFocusTrip(trips: TripSummary[], today = new Date()) {
  const ranked = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    ranked.find((trip) => tripPhase(trip, today) === "active") ??
    ranked.find((trip) => tripPhase(trip, today) === "upcoming") ??
    ranked.at(-1) ??
    null
  );
}

function minutes(label: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(label);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function nextStop(detail: TripDetail, now = new Date()) {
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const ordered = [...detail.days].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = ordered.filter((day) => day.date >= todayIso);
  for (const day of upcoming) {
    const item = firstOpenItem(day, day.date === todayIso ? nowMinutes : null);
    if (item) return { day, item };
  }
  const last = ordered.at(-1);
  const item = last?.items.at(-1);
  return last && item ? { day: last, item } : null;
}

function firstOpenItem(day: DayView, afterMinutes: number | null): TimelineEntry | null {
  if (afterMinutes === null) return day.items[0] ?? null;
  const later = day.items.find((item) => {
    const value = minutes(item.timeLabel);
    return value === null || value >= afterMinutes;
  });
  return later ?? null;
}
