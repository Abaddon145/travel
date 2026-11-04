export type AmapPoi = {
  id: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
  distanceMeters?: number;
};

export type AmapRoute = {
  mode: "walking" | "driving" | "transit";
  distanceMeters: number;
  durationSeconds: number | null;
  polyline: string;
};

export type AmapFailure = {
  ok: false;
  error: "not_configured" | "rate_limited" | "quota_exceeded" | "validation_error" | "upstream_unavailable" | "network" | "not_found";
  message: string;
};

const INFOCODE: Record<string, AmapFailure["error"]> = {
  "10003": "quota_exceeded",
  "10044": "quota_exceeded",
  "10004": "rate_limited",
  "10014": "rate_limited",
  "10015": "rate_limited",
  "10019": "rate_limited",
  "10020": "rate_limited",
  "10021": "rate_limited",
  "10001": "not_configured",
  "10009": "not_configured",
  "10013": "not_configured",
  "20000": "validation_error",
  "20001": "validation_error",
};

export function mapInfocode(infocode: string): AmapFailure["error"] {
  return INFOCODE[infocode] ?? "upstream_unavailable";
}

export function messageFor(error: AmapFailure["error"]) {
  if (error === "not_configured") return "高德密钥还没配置，或密钥类型不对。";
  if (error === "quota_exceeded") return "高德今日配额已用完。";
  if (error === "rate_limited") return "高德请求过于频繁。";
  if (error === "validation_error") return "高德没有接受这些参数。";
  if (error === "not_found") return "高德没有找到对应地点。";
  if (error === "network") return "没有连上高德。";
  return "高德暂时不可用。";
}

export function parseLngLat(value: string) {
  const [lngText, latText] = value.split(",");
  const lng = Number(lngText);
  const lat = Number(latText);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return { lng, lat };
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function parsePois(payload: unknown): AmapPoi[] {
  const pois = (payload as { pois?: unknown }).pois;
  if (!Array.isArray(pois)) return [];
  const result: AmapPoi[] = [];
  for (const poi of pois) {
    if (!poi || typeof poi !== "object") continue;
    const record = poi as Record<string, unknown>;
    const point = parseLngLat(text(record.location));
    const id = text(record.id);
    const name = text(record.name);
    if (!point || !id || !name) continue;
    const distance = text(record.distance);
    const item: AmapPoi = {
      id,
      name,
      address: text(record.address),
      lng: point.lng,
      lat: point.lat,
    };
    if (/^\d+$/.test(distance)) item.distanceMeters = Number(distance);
    result.push(item);
  }
  return result;
}

function firstPath(payload: unknown) {
  const route = (payload as { route?: { paths?: unknown; transits?: unknown } }).route;
  const paths = route?.paths;
  const transits = route?.transits;
  const list = Array.isArray(paths) ? paths : Array.isArray(transits) ? transits : [];
  const first = list[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

export function parseRoute(payload: unknown, mode: AmapRoute["mode"]): AmapRoute | null {
  const path = firstPath(payload);
  if (!path) return null;
  const distanceText = text(path.distance);
  if (!/^\d+$/.test(distanceText)) return null;
  const distance = Number(distanceText);
  const cost = path.cost;
  const durationText =
    cost && typeof cost === "object" ? text((cost as { duration?: unknown }).duration) : "";
  const duration = /^\d+$/.test(durationText) ? Number(durationText) : null;
  const steps = Array.isArray(path.steps) ? path.steps : [];
  const polyline = steps
    .map((step) => (step && typeof step === "object" ? text((step as { polyline?: unknown }).polyline) : ""))
    .filter(Boolean)
    .join(";");
  return { mode, distanceMeters: distance, durationSeconds: duration, polyline: polyline.slice(0, 8000) };
}

export async function amapGet(input: {
  fetchImpl: typeof fetch;
  key: string;
  path: string;
  query: Record<string, string>;
  signal?: AbortSignal;
}) {
  const url = new URL(`https://restapi.amap.com${input.path}`);
  url.searchParams.set("key", input.key);
  for (const [name, value] of Object.entries(input.query)) {
    if (value) url.searchParams.set(name, value);
  }
  const fetchImpl = input.fetchImpl;
  let response: Response;
  try {
    response = await fetchImpl.call(globalThis, url, { signal: input.signal });
  } catch {
    return { ok: false as const, error: "network" as const, message: messageFor("network") };
  }
  if (!response.ok) {
    return {
      ok: false as const,
      error: "upstream_unavailable" as const,
      message: messageFor("upstream_unavailable"),
    };
  }
  const payload = (await response.json().catch(() => null)) as {
    status?: string;
    infocode?: string;
  } | null;
  if (!payload || payload.status !== "1" || payload.infocode !== "10000") {
    const error = mapInfocode(payload?.infocode ?? "");
    return { ok: false as const, error, message: messageFor(error) };
  }
  return { ok: true as const, payload };
}
