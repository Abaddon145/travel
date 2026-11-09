import type { TripSnapshot } from "@/domain/types";
import {
  mockDays,
  mockLodgings,
  mockPlaces,
  mockTimeline,
  mockTrips,
} from "@/data/mock-trips";
import type { TravelDatabase } from "@/db/database";
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
  tripSnapshotSchema,
} from "@/db/validation";

export function seedFromMock(db: TravelDatabase) {
  const trips = mockTrips.map((trip) => tripSchema.parse(trip));
  const days = mockDays.map((day) => daySchema.parse(day));
  const places = mockPlaces.map((place) => placeSchema.parse(place));
  const lodgings = mockLodgings.map((lodging) => lodgingSchema.parse(lodging));
  const timelineItems = mockTimeline.map((item) => timelineItemSchema.parse(item));
  const createdAt = Date.parse("2026-10-02T01:00:00.000Z");

  const versions = trips.map((trip) => {
    const snapshot: TripSnapshot = tripSnapshotSchema.parse({
      trip,
      days: days.filter((day) => day.tripId === trip.id),
      places: places.filter((place) => place.tripId === trip.id),
      lodgings: lodgings.filter((lodging) => lodging.tripId === trip.id),
      timelineItems: timelineItems.filter((item) => item.tripId === trip.id),
    });
    return {
      id: `version-seed-${trip.id}`,
      tripId: trip.id,
      label: "示例行程",
      createdAt,
      snapshot,
    };
  });

  const stamp = { createdAt, updatedAt: createdAt };
  const ledgerEntries = [
    ledgerSchema.parse({
      id: "ledger-kyoto-stay",
      tripId: "trip-kyoto",
      date: "2026-11-12",
      category: "lodging",
      title: "白川住宿",
      note: "四晚",
      currency: "CNY",
      plannedMinor: 320000,
      actualMinor: 286000,
      ...stamp,
    }),
    ledgerSchema.parse({
      id: "ledger-kyoto-rail",
      tripId: "trip-kyoto",
      date: "2026-11-12",
      category: "transport",
      title: "新干线",
      note: "",
      currency: "CNY",
      plannedMinor: 86000,
      actualMinor: 73400,
      ...stamp,
    }),
    ledgerSchema.parse({
      id: "ledger-kyoto-dinner",
      tripId: "trip-kyoto",
      date: "2026-11-13",
      category: "food",
      title: "东山晚饭",
      note: "",
      currency: "CNY",
      plannedMinor: 18000,
      actualMinor: 16400,
      ...stamp,
    }),
    ledgerSchema.parse({
      id: "ledger-kyoto-ticket",
      tripId: "trip-kyoto",
      date: "2026-11-13",
      category: "ticket",
      title: "清水寺门票",
      note: "还没买",
      currency: "CNY",
      plannedMinor: 8000,
      actualMinor: null,
      ...stamp,
    }),
    ledgerSchema.parse({
      id: "ledger-kyoto-coffee",
      tripId: "trip-kyoto",
      date: "2026-11-14",
      category: "food",
      title: "岚山咖啡",
      note: "",
      currency: "CNY",
      plannedMinor: 4500,
      actualMinor: 4500,
      ...stamp,
    }),
    ledgerSchema.parse({
      id: "ledger-kyoto-gift",
      tripId: "trip-kyoto",
      date: "2026-11-15",
      category: "shopping",
      title: "手信",
      note: "",
      currency: "CNY",
      plannedMinor: 20000,
      actualMinor: 12600,
      ...stamp,
    }),
  ];
  const bookings = [
    bookingSchema.parse({
      id: "booking-kyoto-stay",
      tripId: "trip-kyoto",
      kind: "lodging",
      title: "白川旅店",
      date: "2026-11-12",
      endDate: "2026-11-16",
      reference: "KY-2048",
      detail: "白川通",
      note: "靠近三年坂",
      ...stamp,
    }),
    bookingSchema.parse({
      id: "booking-kyoto-train",
      tripId: "trip-kyoto",
      kind: "train",
      title: "のぞみ 231",
      date: "2026-11-12",
      endDate: "",
      reference: "4号车 8A",
      detail: "东京 → 京都",
      note: "",
      ...stamp,
    }),
    bookingSchema.parse({
      id: "booking-kyoto-dinner",
      tripId: "trip-kyoto",
      kind: "reservation",
      title: "三年坂晚饭",
      date: "2026-11-13",
      endDate: "",
      reference: "19:30",
      detail: "两人",
      note: "",
      ...stamp,
    }),
  ];
  const checklistSeed: Array<[string, string, boolean, number]> = [
    ["check-kyoto-passport", "护照", false, 0],
    ["check-kyoto-card", "交通卡", true, 1],
    ["check-kyoto-shoes", "舒适的鞋", false, 2],
  ];
  const checklistItems = checklistSeed.map(([id, title, done, order]) =>
    checklistSchema.parse({
      id,
      tripId: "trip-kyoto",
      title,
      note: "",
      done,
      order,
      ...stamp,
    }),
  );
  const favorites = [
    favoriteSchema.parse({
      id: "fav-kyoto-market",
      tripId: "trip-kyoto",
      title: "锦市场",
      note: "只买腌菜，不安排一餐。",
      ...stamp,
    }),
    favoriteSchema.parse({
      id: "fav-kyoto-path",
      tripId: "trip-kyoto",
      title: "哲学之道",
      note: "若东山太挤，改走这里。",
      ...stamp,
    }),
  ];
  const travelNotes = [
    noteSchema.parse({
      id: "note-kyoto-fushimi",
      tripId: "trip-kyoto",
      title: "稻荷怎么走",
      body: "只走到千本鸟居再折返，不为走完整座山改后面的岚山。",
      date: "2026-11-14",
      ...stamp,
    }),
  ];

  return Promise.all([
    db.trips.bulkAdd(trips),
    db.days.bulkAdd(days),
    db.places.bulkAdd(places),
    db.lodgings.bulkAdd(lodgings),
    db.timelineItems.bulkAdd(timelineItems),
    db.versions.bulkAdd(versions),
    db.ledgerEntries.bulkAdd(ledgerEntries),
    db.bookings.bulkAdd(bookings),
    db.checklistItems.bulkAdd(checklistItems),
    db.favorites.bulkAdd(favorites),
    db.travelNotes.bulkAdd(travelNotes),
  ]);
}
