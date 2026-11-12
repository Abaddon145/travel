import { z } from "zod";
import { amapGet, messageFor, parsePois, parseRoute } from "./amap";
import { mapCookieSecret } from "./cookie";
import { mintMapFrameToken } from "./frame-token";

const lngLat = z.string().regex(/^-?\d{1,3}\.\d{1,6},-?\d{1,2}\.\d{1,6}$/);

const searchSchema = z.object({
  keywords: z.string().trim().min(1).max(80),
  region: z.string().trim().max(40).optional(),
});

const aroundSchema = z.object({
  location: lngLat,
  keywords: z.string().trim().max(80).optional(),
  radius: z.coerce.number().int().min(1).max(50000).optional(),
});

const detailSchema = z.object({ id: z.string().trim().min(1).max(40) });
const geocodeSchema = z.object({ address: z.string().trim().min(1).max(80) });
const regeoSchema = z.object({ location: lngLat });
const routeSchema = z.object({
  mode: z.enum(["walking", "driving", "transit"]),
  origin: lngLat,
  destination: lngLat,
  city: z.string().trim().max(12).optional(),
});

export type MapEnv = {
  ENVIRONMENT?: string;
  ACCESS_DEV_BYPASS?: string;
  OWNER_KEY_SHA256?: string;
  AMAP_JS_KEY?: string;
  AMAP_JS_SECURITY_CODE?: string;
  AMAP_WEB_KEY?: string;
};

function json(body: unknown, status = 200, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export function isMapRoute(pathname: string) {
  return pathname.startsWith("/api/map/");
}

export async function handleMapRequest(
  request: Request,
  env: MapEnv,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
) {
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return json({ error: "method_not_allowed", message: "只接受 GET" }, 405);
  }
  if (url.pathname === "/api/map/config") {
    const key = env.AMAP_JS_KEY?.trim() ?? "";
    if (!key)
      return json(
        { error: "not_configured", message: messageFor("not_configured") },
        501,
      );
    return json({ key, serviceHost: "/_AMapService", version: "2.0" });
  }
  if (url.pathname === "/api/map/frame-token") {
    const secret = mapCookieSecret(env);
    if (!secret)
      return json(
        { error: "not_configured", message: messageFor("not_configured") },
        501,
      );
    return json(await mintMapFrameToken(secret));
  }

  const webKey = env.AMAP_WEB_KEY?.trim() ?? "";
  if (!webKey)
    return json({ error: "not_configured", message: messageFor("not_configured") }, 501);

  const params = Object.fromEntries(url.searchParams.entries());
  if (url.pathname === "/api/map/poi/search")
    return cached(request, () => search(fetchImpl, webKey, params));
  if (url.pathname === "/api/map/poi/around") return around(fetchImpl, webKey, params);
  if (url.pathname === "/api/map/poi/detail") return detail(fetchImpl, webKey, params);
  if (url.pathname === "/api/map/geocode") return geocode(fetchImpl, webKey, params);
  if (url.pathname === "/api/map/regeo") return regeo(fetchImpl, webKey, params);
  if (url.pathname === "/api/map/route") return route(fetchImpl, webKey, params);
  return json({ error: "not_found", message: "没有这个地图接口" }, 404);
}

async function cached(request: Request, load: () => Promise<Response>) {
  const cache = typeof caches === "undefined" ? null : caches.default;
  if (cache) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  const response = await load();
  if (cache && response.ok) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set("cache-control", "public, max-age=600");
    await cache.put(request, stored);
  }
  return response;
}

async function search(
  fetchImpl: typeof fetch,
  key: string,
  params: Record<string, string>,
) {
  const parsed = searchSchema.safeParse(params);
  if (!parsed.success)
    return json({ error: "validation_error", message: "请填写地点关键字" }, 422);
  const result = await call(fetchImpl, key, "/v5/place/text", {
    keywords: parsed.data.keywords,
    region: parsed.data.region ?? "",
    city_limit: parsed.data.region ? "true" : "false",
    page_size: "8",
  });
  if (!result.ok) return json(result, statusFor(result.error));
  return json({ pois: parsePois(result.payload) });
}

async function around(
  fetchImpl: typeof fetch,
  key: string,
  params: Record<string, string>,
) {
  const parsed = aroundSchema.safeParse(params);
  if (!parsed.success)
    return json({ error: "validation_error", message: "坐标不正确" }, 422);
  const result = await call(fetchImpl, key, "/v5/place/around", {
    location: parsed.data.location,
    keywords: parsed.data.keywords ?? "",
    radius: String(parsed.data.radius ?? 3000),
    page_size: "8",
  });
  if (!result.ok) return json(result, statusFor(result.error));
  return json({ pois: parsePois(result.payload) });
}

async function detail(
  fetchImpl: typeof fetch,
  key: string,
  params: Record<string, string>,
) {
  const parsed = detailSchema.safeParse(params);
  if (!parsed.success)
    return json({ error: "validation_error", message: "缺少地点编号" }, 422);
  const result = await call(fetchImpl, key, "/v5/place/detail", { id: parsed.data.id });
  if (!result.ok) return json(result, statusFor(result.error));
  const pois = parsePois(result.payload);
  const poi = pois[0];
  if (!poi) return json({ error: "not_found", message: messageFor("not_found") }, 404);
  return json({ poi });
}

async function geocode(
  fetchImpl: typeof fetch,
  key: string,
  params: Record<string, string>,
) {
  const parsed = geocodeSchema.safeParse(params);
  if (!parsed.success)
    return json({ error: "validation_error", message: "请填写地址" }, 422);
  const result = await call(fetchImpl, key, "/v3/geocode/geo", {
    address: parsed.data.address,
  });
  if (!result.ok) return json(result, statusFor(result.error));
  const geocodes =
    (result.payload as { geocodes?: Record<string, unknown>[] }).geocodes ?? [];
  const first = geocodes[0];
  return json({
    location: typeof first?.location === "string" ? first.location : "",
    citycode: typeof first?.citycode === "string" ? first.citycode : "",
  });
}

async function regeo(
  fetchImpl: typeof fetch,
  key: string,
  params: Record<string, string>,
) {
  const parsed = regeoSchema.safeParse(params);
  if (!parsed.success)
    return json({ error: "validation_error", message: "坐标不正确" }, 422);
  const result = await call(fetchImpl, key, "/v3/geocode/regeo", {
    location: parsed.data.location,
  });
  if (!result.ok) return json(result, statusFor(result.error));
  const address = (result.payload as { regeocode?: { formatted_address?: unknown } })
    .regeocode?.formatted_address;
  return json({ address: typeof address === "string" ? address : "" });
}

async function route(
  fetchImpl: typeof fetch,
  key: string,
  params: Record<string, string>,
) {
  const parsed = routeSchema.safeParse(params);
  if (!parsed.success)
    return json({ error: "validation_error", message: "路线参数不正确" }, 422);
  if (parsed.data.mode === "transit") {
    if (!parsed.data.city) {
      return json({ error: "validation_error", message: "公交需要城市编码" }, 422);
    }
    const result = await call(fetchImpl, key, "/v3/direction/transit/integrated", {
      origin: parsed.data.origin,
      destination: parsed.data.destination,
      city: parsed.data.city,
      extensions: "all",
    });
    if (!result.ok) return json(result, statusFor(result.error));
    const routeResult = parseRoute(result.payload, parsed.data.mode);
    if (!routeResult)
      return json({ error: "not_found", message: "高德没有返回可用路线" }, 404);
    return json({ route: routeResult, fetchedAt: Date.now() });
  }
  const path =
    parsed.data.mode === "walking" ? "/v5/direction/walking" : "/v5/direction/driving";
  const query: Record<string, string> = {
    origin: parsed.data.origin,
    destination: parsed.data.destination,
    show_fields: "cost,polyline",
  };
  const result = await call(fetchImpl, key, path, query);
  if (!result.ok) return json(result, statusFor(result.error));
  const routeResult = parseRoute(result.payload, parsed.data.mode);
  if (!routeResult)
    return json({ error: "not_found", message: "高德没有返回可用路线" }, 404);
  return json({ route: routeResult, fetchedAt: Date.now() });
}

async function call(
  fetchImpl: typeof fetch,
  key: string,
  path: string,
  query: Record<string, string>,
) {
  let last = await amapGet({
    fetchImpl,
    key,
    path,
    query,
    signal: AbortSignal.timeout(8000),
  });
  if (!last.ok && (last.error === "network" || last.error === "upstream_unavailable")) {
    last = await amapGet({
      fetchImpl,
      key,
      path,
      query,
      signal: AbortSignal.timeout(8000),
    });
  }
  return last;
}

function statusFor(error: string) {
  if (error === "not_configured") return 501;
  if (error === "validation_error") return 422;
  if (error === "rate_limited" || error === "quota_exceeded") return 429;
  if (error === "not_found") return 404;
  return 502;
}
