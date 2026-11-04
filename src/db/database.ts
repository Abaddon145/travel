import Dexie, { type EntityTable } from "dexie";
import type {
  Day,
  Lodging,
  Place,
  TimelineItem,
  Trip,
  TripVersion,
} from "@/domain/types";
import { DatabaseUnavailableError } from "@/db/errors";
import { migrateV1ToV2 } from "@/db/migrate";
import { requestPersistentStorage } from "@/db/persistence";
import { seedFromMock } from "@/db/seed";

export const DB_NAME = "lvxu-travel";

export type TravelDatabaseOptions = {
  seed?: boolean;
};

export class TravelDatabase extends Dexie {
  trips!: EntityTable<Trip, "id">;
  days!: EntityTable<Day, "id">;
  places!: EntityTable<Place, "id">;
  lodgings!: EntityTable<Lodging, "id">;
  timelineItems!: EntityTable<TimelineItem, "id">;
  versions!: EntityTable<TripVersion, "id">;

  constructor(name = DB_NAME, options: TravelDatabaseOptions = {}) {
    super(name);
    const seed = options.seed !== false;

    this.version(1).stores({
      trips: "id, updatedAt",
      itinerary: "id, tripId, dayDate, order",
    });

    this.version(2)
      .stores({
        days: "id, tripId, date, [tripId+date]",
        places: "id, tripId",
        lodgings: "id, tripId",
        timelineItems: "id, tripId, dayId, order, [dayId+order]",
        versions: "id, tripId, createdAt",
      })
      .upgrade((transaction) => migrateV1ToV2(transaction));

    this.version(3).stores({
      itinerary: null,
    });

    this.on("populate", () => {
      if (!seed) return undefined;
      return seedFromMock(this);
    });
  }
}

export const db = new TravelDatabase();

export async function initDatabase(database: TravelDatabase = db) {
  if (typeof indexedDB === "undefined") {
    throw new DatabaseUnavailableError();
  }
  if (!database.isOpen()) {
    await database.open();
  }
  void requestPersistentStorage();
}

export async function resetDatabase(database: TravelDatabase = db) {
  database.close();
  await database.delete();
}
