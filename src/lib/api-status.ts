export type ApiUiState =
  | { kind: "connected" }
  | { kind: "unauthorized" }
  | { kind: "unconfigured" }
  | { kind: "rate_limited" }
  | { kind: "error" };

type StatusBody = {
  auth?: string;
};

export async function readApiStatus(
  fetchImpl: typeof fetch = fetch,
): Promise<ApiUiState> {
  try {
    const response = await fetchImpl("/api/status", {
      headers: { accept: "application/json" },
    });
    if (response.status === 429) return { kind: "rate_limited" };
    if (response.status === 401 || response.status === 403)
      return { kind: "unauthorized" };
    if (!response.ok) return { kind: "error" };
    const body = (await response.json()) as StatusBody;
    if (body.auth === "connected") return { kind: "connected" };
    if (body.auth === "unconfigured") return { kind: "unconfigured" };
    if (body.auth === "unauthorized") return { kind: "unauthorized" };
    if (body.auth === "rate_limited") return { kind: "rate_limited" };
    return { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
