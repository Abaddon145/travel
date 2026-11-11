import { isShellOrigin } from "../shared/shell-origin";

const allowHeaders = "authorization, content-type, accept, x-lvxu-owner-key";
const allowMethods = "GET, POST, OPTIONS";

function corsHeaders(origin: string) {
  const headers = new Headers();
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.set("vary", "origin");
  return headers;
}

export function shellPreflight(request: Request) {
  const origin = request.headers.get("origin");
  if (!isShellOrigin(origin) || !origin) return null;
  const headers = corsHeaders(origin);
  headers.set("access-control-allow-methods", allowMethods);
  headers.set("access-control-allow-headers", allowHeaders);
  headers.set("access-control-max-age", "86400");
  headers.set("cache-control", "no-store");
  return new Response(null, { status: 204, headers });
}

export function withShellCors(request: Request, response: Response) {
  const origin = request.headers.get("origin");
  if (!isShellOrigin(origin) || !origin) return response;
  const headers = new Headers(response.headers);
  const cors = corsHeaders(origin);
  cors.forEach((value, name) => {
    headers.set(name, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
