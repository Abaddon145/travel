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

  return Promise.all([
    db.trips.bulkAdd(trips),
    db.days.bulkAdd(days),
    db.places.bulkAdd(places),
    db.lodgings.bulkAdd(lodgings),
    db.timelineItems.bulkAdd(timelineItems),
    db.versions.bulkAdd(versions),
  ]);
}
