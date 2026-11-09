import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db/database";
import { DataIntegrityError, ValidationError } from "@/db/errors";
import { readTripTools } from "@/db/tools";

export function useTripTools(tripId: string) {
  return useLiveQuery(async () => {
    try {
      return await readTripTools(db, tripId);
    } catch (error) {
      if (error instanceof ValidationError) throw new DataIntegrityError();
      throw error;
    }
  }, [tripId]);
}
