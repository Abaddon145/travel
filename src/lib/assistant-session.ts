export type AssistantTurn = { role: "user" | "assistant"; text: string };

export type AssistantSession = {
  history: AssistantTurn[];
  instruction: string;
  dayId: string;
};

const empty: AssistantSession = { history: [], instruction: "", dayId: "" };

export function assistantSessionKey(tripId: string) {
  return `lvxu-assistant:${tripId}`;
}

export function readAssistantSession(tripId: string): AssistantSession {
  try {
    const raw = sessionStorage.getItem(assistantSessionKey(tripId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<AssistantSession>;
    const history = Array.isArray(parsed.history)
      ? parsed.history
          .filter(
            (turn): turn is AssistantTurn =>
              !!turn &&
              (turn.role === "user" || turn.role === "assistant") &&
              typeof turn.text === "string",
          )
          .slice(-8)
      : [];
    return {
      history,
      instruction: typeof parsed.instruction === "string" ? parsed.instruction : "",
      dayId: typeof parsed.dayId === "string" ? parsed.dayId : "",
    };
  } catch {
    return empty;
  }
}

export function writeAssistantSession(tripId: string, session: AssistantSession) {
  try {
    sessionStorage.setItem(
      assistantSessionKey(tripId),
      JSON.stringify({
        history: session.history.slice(-8),
        instruction: session.instruction,
        dayId: session.dayId,
      }),
    );
  } catch {
    // Private mode can refuse storage. The conversation still works until leave.
  }
}
