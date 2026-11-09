import type { TripTools } from "@/domain/types";
import type { TravelDatabase } from "@/db/database";
import { NotFoundError, StorageQuotaError, isQuotaError } from "@/db/errors";
import {
  parseBooking,
  parseBookingInput,
  parseChecklist,
  parseChecklistInput,
  parseFavorite,
  parseFavoriteInput,
  parseLedger,
  parseLedgerInput,
  parseNoteInput,
  parseTravelNote,
  parseTripTools,
} from "@/db/tool-validation";

function guard<T>(work: () => Promise<T>) {
  return work().catch((error: unknown) => {
    if (error instanceof StorageQuotaError) throw error;
    if (isQuotaError(error)) throw new StorageQuotaError();
    throw error;
  });
}

function createId() {
  return crypto.randomUUID();
}

async function requireTrip(db: TravelDatabase, tripId: string) {
  const trip = await db.trips.get(tripId);
  if (!trip) throw new NotFoundError();
  return trip;
}

export function toolTables(db: TravelDatabase) {
  return [db.ledgerEntries, db.bookings, db.checklistItems, db.favorites, db.travelNotes];
}

export async function readTripTools(db: TravelDatabase, tripId: string): Promise<TripTools> {
  const [ledgerEntries, bookings, checklistItems, favorites, travelNotes] = await Promise.all([
    db.ledgerEntries.where("tripId").equals(tripId).toArray(),
    db.bookings.where("tripId").equals(tripId).toArray(),
    db.checklistItems.where("tripId").equals(tripId).toArray(),
    db.favorites.where("tripId").equals(tripId).toArray(),
    db.travelNotes.where("tripId").equals(tripId).toArray(),
  ]);
  const tools = parseTripTools({
    ledgerEntries,
    bookings,
    checklistItems,
    favorites,
    travelNotes,
  });
  tools.checklistItems.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  tools.ledgerEntries.sort((a, b) => a.date.localeCompare(b.date) || b.updatedAt - a.updatedAt);
  tools.bookings.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "zh"));
  tools.favorites.sort((a, b) => b.createdAt - a.createdAt);
  tools.travelNotes.sort((a, b) => b.updatedAt - a.updatedAt);
  return tools;
}

export async function deleteTripTools(db: TravelDatabase, tripId: string) {
  await db.ledgerEntries.where("tripId").equals(tripId).delete();
  await db.bookings.where("tripId").equals(tripId).delete();
  await db.checklistItems.where("tripId").equals(tripId).delete();
  await db.favorites.where("tripId").equals(tripId).delete();
  await db.travelNotes.where("tripId").equals(tripId).delete();
}

export async function replaceTripTools(db: TravelDatabase, tripId: string, tools: TripTools) {
  await deleteTripTools(db, tripId);
  if (tools.ledgerEntries.length) await db.ledgerEntries.bulkAdd(tools.ledgerEntries);
  if (tools.bookings.length) await db.bookings.bulkAdd(tools.bookings);
  if (tools.checklistItems.length) await db.checklistItems.bulkAdd(tools.checklistItems);
  if (tools.favorites.length) await db.favorites.bulkAdd(tools.favorites);
  if (tools.travelNotes.length) await db.travelNotes.bulkAdd(tools.travelNotes);
}

export async function createLedgerEntry(db: TravelDatabase, tripId: string, input: unknown) {
  const parsed = parseLedgerInput(input);
  const now = Date.now();
  const entry = parseLedger({
    ...parsed,
    id: createId(),
    tripId,
    createdAt: now,
    updatedAt: now,
  });
  await guard(() =>
    db.transaction("rw", [db.trips, db.ledgerEntries], async () => {
      await requireTrip(db, tripId);
      await db.ledgerEntries.add(entry);
    }),
  );
  return entry;
}

export async function updateLedgerEntry(db: TravelDatabase, entryId: string, input: unknown) {
  const parsed = parseLedgerInput(input);
  await guard(() =>
    db.transaction("rw", db.ledgerEntries, async () => {
      const current = await db.ledgerEntries.get(entryId);
      if (!current) throw new NotFoundError();
      await db.ledgerEntries.put(
        parseLedger({ ...current, ...parsed, updatedAt: Date.now() }),
      );
    }),
  );
}

export async function deleteLedgerEntry(db: TravelDatabase, entryId: string) {
  const current = await db.ledgerEntries.get(entryId);
  if (!current) throw new NotFoundError();
  const parsed = parseLedger(current);
  await guard(() => db.ledgerEntries.delete(entryId));
  return parsed;
}

export async function restoreLedgerEntry(db: TravelDatabase, value: unknown) {
  const parsed = parseLedger(value);
  await guard(() =>
    db.transaction("rw", [db.trips, db.ledgerEntries], async () => {
      await requireTrip(db, parsed.tripId);
      await db.ledgerEntries.put(parsed);
    }),
  );
}

export async function createBooking(db: TravelDatabase, tripId: string, input: unknown) {
  const parsed = parseBookingInput(input);
  const now = Date.now();
  const booking = parseBooking({
    ...parsed,
    id: createId(),
    tripId,
    createdAt: now,
    updatedAt: now,
  });
  await guard(() =>
    db.transaction("rw", [db.trips, db.bookings], async () => {
      await requireTrip(db, tripId);
      await db.bookings.add(booking);
    }),
  );
  return booking;
}

export async function updateBooking(db: TravelDatabase, bookingId: string, input: unknown) {
  const parsed = parseBookingInput(input);
  await guard(() =>
    db.transaction("rw", db.bookings, async () => {
      const current = await db.bookings.get(bookingId);
      if (!current) throw new NotFoundError();
      await db.bookings.put(parseBooking({ ...current, ...parsed, updatedAt: Date.now() }));
    }),
  );
}

export async function deleteBooking(db: TravelDatabase, bookingId: string) {
  const current = await db.bookings.get(bookingId);
  if (!current) throw new NotFoundError();
  const parsed = parseBooking(current);
  await guard(() => db.bookings.delete(bookingId));
  return parsed;
}

export async function restoreBooking(db: TravelDatabase, value: unknown) {
  const parsed = parseBooking(value);
  await guard(() =>
    db.transaction("rw", [db.trips, db.bookings], async () => {
      await requireTrip(db, parsed.tripId);
      await db.bookings.put(parsed);
    }),
  );
}

export async function createChecklistItem(db: TravelDatabase, tripId: string, input: unknown) {
  const parsed = parseChecklistInput(input);
  const now = Date.now();
  const item = await guard(() =>
    db.transaction("rw", [db.trips, db.checklistItems], async () => {
      await requireTrip(db, tripId);
      const siblings = await db.checklistItems.where("tripId").equals(tripId).toArray();
      const order = siblings.reduce((max, row) => Math.max(max, row.order), -1) + 1;
      const next = parseChecklist({
        ...parsed,
        id: createId(),
        tripId,
        order,
        createdAt: now,
        updatedAt: now,
      });
      await db.checklistItems.add(next);
      return next;
    }),
  );
  return item;
}

export async function updateChecklistItem(db: TravelDatabase, itemId: string, input: unknown) {
  const parsed = parseChecklistInput(input);
  await guard(() =>
    db.transaction("rw", db.checklistItems, async () => {
      const current = await db.checklistItems.get(itemId);
      if (!current) throw new NotFoundError();
      await db.checklistItems.put(
        parseChecklist({ ...current, ...parsed, updatedAt: Date.now() }),
      );
    }),
  );
}

export async function deleteChecklistItem(db: TravelDatabase, itemId: string) {
  const current = await db.checklistItems.get(itemId);
  if (!current) throw new NotFoundError();
  const parsed = parseChecklist(current);
  await guard(() => db.checklistItems.delete(itemId));
  return parsed;
}

export async function restoreChecklistItem(db: TravelDatabase, value: unknown) {
  const parsed = parseChecklist(value);
  await guard(() =>
    db.transaction("rw", [db.trips, db.checklistItems], async () => {
      await requireTrip(db, parsed.tripId);
      await db.checklistItems.put(parsed);
    }),
  );
}

export async function createFavorite(db: TravelDatabase, tripId: string, input: unknown) {
  const parsed = parseFavoriteInput(input);
  const now = Date.now();
  const favorite = parseFavorite({
    ...parsed,
    id: createId(),
    tripId,
    createdAt: now,
    updatedAt: now,
  });
  await guard(() =>
    db.transaction("rw", [db.trips, db.favorites], async () => {
      await requireTrip(db, tripId);
      await db.favorites.add(favorite);
    }),
  );
  return favorite;
}

export async function updateFavorite(db: TravelDatabase, favoriteId: string, input: unknown) {
  const parsed = parseFavoriteInput(input);
  await guard(() =>
    db.transaction("rw", db.favorites, async () => {
      const current = await db.favorites.get(favoriteId);
      if (!current) throw new NotFoundError();
      await db.favorites.put(parseFavorite({ ...current, ...parsed, updatedAt: Date.now() }));
    }),
  );
}

export async function deleteFavorite(db: TravelDatabase, favoriteId: string) {
  const current = await db.favorites.get(favoriteId);
  if (!current) throw new NotFoundError();
  const parsed = parseFavorite(current);
  await guard(() => db.favorites.delete(favoriteId));
  return parsed;
}

export async function restoreFavorite(db: TravelDatabase, value: unknown) {
  const parsed = parseFavorite(value);
  await guard(() =>
    db.transaction("rw", [db.trips, db.favorites], async () => {
      await requireTrip(db, parsed.tripId);
      await db.favorites.put(parsed);
    }),
  );
}

export async function createTravelNote(db: TravelDatabase, tripId: string, input: unknown) {
  const parsed = parseNoteInput(input);
  const now = Date.now();
  const note = parseTravelNote({
    ...parsed,
    id: createId(),
    tripId,
    createdAt: now,
    updatedAt: now,
  });
  await guard(() =>
    db.transaction("rw", [db.trips, db.travelNotes], async () => {
      await requireTrip(db, tripId);
      await db.travelNotes.add(note);
    }),
  );
  return note;
}

export async function updateTravelNote(db: TravelDatabase, noteId: string, input: unknown) {
  const parsed = parseNoteInput(input);
  await guard(() =>
    db.transaction("rw", db.travelNotes, async () => {
      const current = await db.travelNotes.get(noteId);
      if (!current) throw new NotFoundError();
      await db.travelNotes.put(parseTravelNote({ ...current, ...parsed, updatedAt: Date.now() }));
    }),
  );
}

export async function deleteTravelNote(db: TravelDatabase, noteId: string) {
  const current = await db.travelNotes.get(noteId);
  if (!current) throw new NotFoundError();
  const parsed = parseTravelNote(current);
  await guard(() => db.travelNotes.delete(noteId));
  return parsed;
}

export async function restoreTravelNote(db: TravelDatabase, value: unknown) {
  const parsed = parseTravelNote(value);
  await guard(() =>
    db.transaction("rw", [db.trips, db.travelNotes], async () => {
      await requireTrip(db, parsed.tripId);
      await db.travelNotes.put(parsed);
    }),
  );
}
