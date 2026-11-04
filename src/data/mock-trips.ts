import type {
  Day,
  DayView,
  Lodging,
  Place,
  TimelineEntry,
  TimelineItem,
  Trip,
  TripDetail,
  TripSummary,
} from "@/domain/types";

const t = Date.parse("2026-10-02T01:00:00.000Z");

export const mockTrips: Trip[] = [
  {
    id: "trip-kyoto",
    title: "京都秋日",
    destination: "京都",
    startDate: "2026-11-12",
    endDate: "2026-11-16",
    summary: "东山、伏见与岚山，住在白川边，走路就能回到房间。",
    createdAt: t,
    updatedAt: t,
  },
  {
    id: "trip-hangzhou",
    title: "杭州周末",
    destination: "杭州",
    startDate: "2026-11-21",
    endDate: "2026-11-22",
    summary: "两天只留西湖和灵隐，傍晚回到湖边。",
    createdAt: t + 1,
    updatedAt: t + 1,
  },
];

export const mockDays: Day[] = [
  day(
    "day-kyoto-1",
    "trip-kyoto",
    "2026-11-12",
    "抵达白川",
    "放下行李，只在附近走走。",
    0,
  ),
  day("day-kyoto-2", "trip-kyoto", "2026-11-13", "东山", "清水寺安排在早上。", 1),
  day(
    "day-kyoto-3",
    "trip-kyoto",
    "2026-11-14",
    "伏见与岚山",
    "稻荷很早出发，下午再去岚山。",
    2,
  ),
  day("day-kyoto-4", "trip-kyoto", "2026-11-15", "北野", "这一天留白多一些。", 3),
  day("day-kyoto-5", "trip-kyoto", "2026-11-16", "离开", "上午退房。", 4),
  day("day-hz-1", "trip-hangzhou", "2026-11-21", "西湖", "沿北线慢慢走。", 0),
  day("day-hz-2", "trip-hangzhou", "2026-11-22", "灵隐", "中午前结束。", 1),
];

export const mockPlaces: Place[] = [
  place(
    "place-sannenzaka",
    "trip-kyoto",
    "三年坂",
    "东山区",
    "晚饭前散步，不安排停留太久。",
  ),
  place("place-kiyomizu", "trip-kyoto", "清水寺", "东山区", "开门就到，避开旅行团。"),
  place("place-ninenzaka", "trip-kyoto", "二年坂", "东山区", "下山顺路。"),
  place("place-fushimi", "trip-kyoto", "伏见稻荷", "伏见区", "只走到千本鸟居再折返。"),
  place("place-arashiyama", "trip-kyoto", "渡月桥", "岚山", "桥上停留，不进园。"),
  place("place-kinkaku", "trip-kyoto", "金阁寺", "北区", "看完即走。"),
  place("place-westlake", "trip-hangzhou", "白堤", "西湖", "从断桥走到平湖秋月。"),
  place("place-lingyin", "trip-hangzhou", "灵隐寺", "西湖区", "飞来峰只在寺外看一眼。"),
];

export const mockLodgings: Lodging[] = [
  lodging(
    "stay-shirakawa",
    "trip-kyoto",
    "白川庵",
    "东山区",
    "房间对着小溪，行李不用每天搬。",
    "2026-11-12",
    "2026-11-16",
  ),
  lodging(
    "stay-westlake",
    "trip-hangzhou",
    "湖滨小馆",
    "湖滨",
    "步行可以回到白堤。",
    "2026-11-21",
    "2026-11-22",
  ),
];

export const mockTimeline: TimelineItem[] = [
  item(
    "item-1",
    "trip-kyoto",
    "day-kyoto-1",
    "lodging",
    "stay-shirakawa",
    0,
    true,
    "15:00",
  ),
  item(
    "item-2",
    "trip-kyoto",
    "day-kyoto-1",
    "place",
    "place-sannenzaka",
    1,
    false,
    "17:30",
  ),
  item(
    "item-3",
    "trip-kyoto",
    "day-kyoto-2",
    "place",
    "place-kiyomizu",
    0,
    false,
    "08:30",
  ),
  item(
    "item-4",
    "trip-kyoto",
    "day-kyoto-2",
    "place",
    "place-ninenzaka",
    1,
    false,
    "11:00",
  ),
  item(
    "item-5",
    "trip-kyoto",
    "day-kyoto-3",
    "place",
    "place-fushimi",
    0,
    false,
    "07:40",
  ),
  item(
    "item-6",
    "trip-kyoto",
    "day-kyoto-3",
    "place",
    "place-arashiyama",
    1,
    false,
    "14:00",
  ),
  item(
    "item-7",
    "trip-kyoto",
    "day-kyoto-4",
    "place",
    "place-kinkaku",
    0,
    false,
    "10:00",
  ),
  item(
    "item-8",
    "trip-kyoto",
    "day-kyoto-5",
    "lodging",
    "stay-shirakawa",
    0,
    true,
    "11:00",
  ),
  item(
    "item-9",
    "trip-hangzhou",
    "day-hz-1",
    "place",
    "place-westlake",
    0,
    false,
    "14:00",
  ),
  item(
    "item-10",
    "trip-hangzhou",
    "day-hz-1",
    "lodging",
    "stay-westlake",
    1,
    false,
    "18:00",
  ),
  item(
    "item-11",
    "trip-hangzhou",
    "day-hz-2",
    "place",
    "place-lingyin",
    0,
    false,
    "09:00",
  ),
];

function day(
  id: string,
  tripId: string,
  date: string,
  title: string,
  note: string,
  order: number,
): Day {
  return { id, tripId, date, title, note, order, createdAt: t, updatedAt: t };
}

function place(
  id: string,
  tripId: string,
  name: string,
  area: string,
  note: string,
): Place {
  return { id, tripId, name, area, note, createdAt: t, updatedAt: t };
}

function lodging(
  id: string,
  tripId: string,
  name: string,
  area: string,
  note: string,
  checkIn: string,
  checkOut: string,
): Lodging {
  return { id, tripId, name, area, note, checkIn, checkOut, createdAt: t, updatedAt: t };
}

function item(
  id: string,
  tripId: string,
  dayId: string,
  kind: TimelineItem["kind"],
  refId: string,
  order: number,
  locked: boolean,
  timeLabel: string,
): TimelineItem {
  return {
    id,
    tripId,
    dayId,
    kind,
    refId,
    order,
    locked,
    timeLabel,
    createdAt: t,
    updatedAt: t,
  };
}

function entryFor(itemRow: TimelineItem): TimelineEntry | null {
  if (itemRow.kind === "place") {
    const placeRow = mockPlaces.find((row) => row.id === itemRow.refId);
    if (!placeRow) return null;
    return {
      id: itemRow.id,
      kind: "place",
      refId: placeRow.id,
      name: placeRow.name,
      area: placeRow.area,
      note: placeRow.note,
      timeLabel: itemRow.timeLabel,
      locked: itemRow.locked,
      order: itemRow.order,
    };
  }
  const stay = mockLodgings.find((row) => row.id === itemRow.refId);
  if (!stay) return null;
  return {
    id: itemRow.id,
    kind: "lodging",
    refId: stay.id,
    name: stay.name,
    area: stay.area,
    note: stay.note,
    timeLabel: itemRow.timeLabel,
    locked: itemRow.locked,
    order: itemRow.order,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
  };
}

export function listTripSummaries(trips: Trip[] = mockTrips): TripSummary[] {
  return [...trips]
    .sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title, "zh"))
    .map((trip) => ({
      id: trip.id,
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      summary: trip.summary,
      dayCount: mockDays.filter((dayRow) => dayRow.tripId === trip.id).length,
      updatedAt: trip.updatedAt,
    }));
}

export function getTripDetail(tripId: string): TripDetail | undefined {
  const trip = mockTrips.find((row) => row.id === tripId);
  if (!trip) return undefined;
  const days: DayView[] = mockDays
    .filter((row) => row.tripId === tripId)
    .sort((a, b) => a.order - b.order || a.date.localeCompare(b.date))
    .map((row) => ({
      id: row.id,
      date: row.date,
      title: row.title,
      note: row.note,
      order: row.order,
      items: mockTimeline
        .filter((itemRow) => itemRow.dayId === row.id)
        .sort((a, b) => a.order - b.order)
        .flatMap((itemRow) => {
          const entry = entryFor(itemRow);
          return entry ? [entry] : [];
        }),
    }));
  return {
    ...listTripSummaries([trip])[0],
    days,
  };
}
