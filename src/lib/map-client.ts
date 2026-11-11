import { resolveApiPath } from "@/lib/api-origin";
import { gatedHeaders } from "@/lib/owner-key";
import type { RouteMode } from "@/lib/route-status";

export type MapConfig = { key: string; serviceHost: string; version: string };
export type PoiCandidate = {
  id: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
  distanceMeters?: number;
};
export type MapRouteResult = {
  mode: RouteMode;
  distanceMeters: number;
  durationSeconds: number | null;
  polyline: string;
  fetchedAt: number;
};

async function readJson(path: string) {
  const response = await fetch(resolveApiPath(path), {
    headers: gatedHeaders(path, { accept: "application/json" }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
  } | null;
  return { response, body };
}

export async function loadMapConfig(): Promise<
  | { ok: true; config: MapConfig }
  | { ok: false; error: "not_configured" | "unauthorized" | "network" }
> {
  try {
    const { response, body } = await readJson("/api/map/config");
    if (response.status === 401) return { ok: false, error: "unauthorized" };
    if (response.status === 501) return { ok: false, error: "not_configured" };
    if (!response.ok || !body || !("key" in body)) return { ok: false, error: "network" };
    return { ok: true, config: body as unknown as MapConfig };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function searchPlaces(keywords: string, region: string) {
  const query = new URLSearchParams({ keywords, region });
  const { response, body } = await readJson(`/api/map/poi/search?${query}`);
  if (!response.ok)
    return { ok: false as const, message: body?.message ?? "没有搜到地点" };
  return { ok: true as const, pois: (body as { pois?: PoiCandidate[] }).pois ?? [] };
}

export async function geocodeCity(address: string) {
  const { response, body } = await readJson(
    `/api/map/geocode?address=${encodeURIComponent(address)}`,
  );
  if (!response.ok || !body) return "";
  return typeof (body as { citycode?: unknown }).citycode === "string"
    ? (body as { citycode: string }).citycode
    : "";
}

export async function fetchMapRoute(input: {
  mode: RouteMode;
  origin: string;
  destination: string;
  city?: string;
}) {
  const query = new URLSearchParams({
    mode: input.mode,
    origin: input.origin,
    destination: input.destination,
  });
  if (input.city) query.set("city", input.city);
  const { response, body } = await readJson(`/api/map/route?${query}`);
  if (!response.ok || !body || !("route" in body)) {
    return { ok: false as const, message: body?.message ?? "没有路线" };
  }
  const routeBody = body as unknown as { route: MapRouteResult; fetchedAt: number };
  return { ok: true as const, route: routeBody.route, fetchedAt: routeBody.fetchedAt };
}
