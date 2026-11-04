import { mapCookieSecret, mapCookieValid } from "./cookie";

export type ProxyEnv = {
  ENVIRONMENT?: string;
  ACCESS_DEV_BYPASS?: string;
  OWNER_KEY_SHA256?: string;
  AMAP_JS_SECURITY_CODE?: string;
};

function failure(status: number, error: string, message: string) {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function handleAmapProxy(
  request: Request,
  env: ProxyEnv,
  limit: (input: { key: string }) => Promise<{ success: boolean }>,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
) {
  const secret = mapCookieSecret(env);
  const security = env.AMAP_JS_SECURITY_CODE?.trim() ?? "";
  if (!secret || !security) {
    return failure(501, "not_configured", "高德安全密钥还没配置。");
  }
  const allowed = await mapCookieValid(secret, request.headers.get("cookie"));
  if (!allowed) return failure(401, "unauthorized", "地图代理需要已验证的本机。");

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const gate = await limit({ key: `amap-proxy:${ip}` });
  if (!gate.success) return failure(429, "rate_limited", "地图请求过于频繁。");

  const inbound = new URL(request.url);
  const rest = inbound.pathname.replace(/^\/_AMapService/, "") || "/";
  const upstream = rest.startsWith("/v4/map/styles")
    ? new URL(`https://webapi.amap.com${rest}`)
    : new URL(`https://restapi.amap.com${rest}`);
  upstream.search = inbound.search;
  upstream.searchParams.set("jscode", security);

  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);
  let response: Response;
  try {
    response = await fetchImpl.call(globalThis, upstream, {
      method: request.method === "POST" ? "POST" : "GET",
      headers,
      body: request.method === "POST" ? request.body : undefined,
    });
  } catch {
    return failure(502, "network", "没有连上高德。");
  }
  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
      "cache-control": "no-store",
    },
  });
}
