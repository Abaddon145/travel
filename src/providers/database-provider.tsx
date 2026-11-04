import { useEffect, useState, type ReactNode } from "react";
import { DatabaseStatus } from "@/components/database-status";
import { db, initDatabase } from "@/db/database";
import { DatabaseUnavailableError } from "@/db/errors";

type Status = "loading" | "ready" | "error" | "unavailable";

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    initDatabase()
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(error instanceof DatabaseUnavailableError ? "unavailable" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    db.close();
    setStatus("loading");
    setAttempt((value) => value + 1);
  };

  if (status === "loading") return <DatabaseStatus kind="loading" />;
  if (status === "unavailable")
    return <DatabaseStatus kind="unavailable" onRetry={retry} />;
  if (status === "error") return <DatabaseStatus kind="error" onRetry={retry} />;
  return children;
}
