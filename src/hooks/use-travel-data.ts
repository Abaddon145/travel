import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { readTripDetail, readTripSummaries, readVersions } from "@/db/repository";

export function useTripSummaries() {
  return useLiveQuery(() => readTripSummaries(db), []);
}

export function useTripDetail(tripId: string) {
  return useLiveQuery(() => readTripDetail(db, tripId), [tripId]);
}

export function useTripVersions(tripId: string) {
  return useLiveQuery(() => readVersions(db, tripId), [tripId]);
}
