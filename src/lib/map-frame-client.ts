import { isMapFrameToken } from "@shared/map-frame";
import { resolveApiPath } from "@/lib/api-origin";
import { gatedHeaders } from "@/lib/owner-key";

export async function loadMapFrameToken(): Promise<
  { ok: true; token: string; expiresAt: number } | { ok: false }
> {
  try {
    const response = await fetch(resolveApiPath("/api/map/frame-token"), {
      headers: gatedHeaders("/api/map/frame-token", { accept: "application/json" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false };
    const body = (await response.json()) as { token?: unknown; expiresAt?: unknown };
    if (typeof body.token !== "string" || !isMapFrameToken(body.token))
      return { ok: false };
    if (typeof body.expiresAt !== "number" || !Number.isFinite(body.expiresAt))
      return { ok: false };
    return { ok: true, token: body.token, expiresAt: body.expiresAt };
  } catch {
    return { ok: false };
  }
}
