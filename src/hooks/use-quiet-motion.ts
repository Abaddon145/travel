import { useReducedMotion } from "motion/react";

function saveDataEnabled() {
  if (typeof navigator === "undefined" || !("connection" in navigator)) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

export function useQuietMotion() {
  const reduce = useReducedMotion();
  return reduce !== false || saveDataEnabled();
}
