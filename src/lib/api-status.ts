import { resolveApiPath } from "@/lib/api-origin";

export type ApiAuthMode = "owner-key" | "access" | "either";

export type ApiUiState = {
  kind: "connected" | "unauthorized" | "unconfigured" | "rate_limited" | "error";
  authMode?: ApiAuthMode;
  configured?: boolean;
};

type StatusBody = {
  auth?: string;
  authMode?: string;
  configured?: boolean;
};

function authMode(value: string | undefined): ApiAuthMode | undefined {
  if (value === "owner-key" || value === "access" || value === "either") return value;
  return undefined;
}

export async function readApiStatus(
  fetchImpl: typeof fetch = fetch,
): Promise<ApiUiState> {
  try {
    const response = await fetchImpl(resolveApiPath("/api/status"), {
      headers: { accept: "application/json" },
    });
    if (response.status === 429) return { kind: "rate_limited" };
    if (response.status === 401 || response.status === 403)
      return { kind: "unauthorized" };
    if (!response.ok) return { kind: "error" };
    const body = (await response.json()) as StatusBody;
    const detail = { authMode: authMode(body.authMode), configured: body.configured };
    if (body.auth === "connected") return { kind: "connected", ...detail };
    if (body.auth === "unconfigured") return { kind: "unconfigured", ...detail };
    if (body.auth === "unauthorized") return { kind: "unauthorized", ...detail };
    if (body.auth === "rate_limited") return { kind: "rate_limited", ...detail };
    return { kind: "error", ...detail };
  } catch {
    return { kind: "error" };
  }
}
