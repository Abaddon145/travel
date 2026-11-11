import { workerOrigin } from "@shared/shell-origin";
import { isNativeShell } from "@/lib/api-origin";
import { readOwnerKey } from "@/lib/owner-key";

const proxyPrefix = `${workerOrigin}/_AMapService`;
const urls = new WeakMap<XMLHttpRequest, string>();

let installed = false;
let restore: (() => void) | null = null;

export function isAmapProxyUrl(url: string) {
  return (
    url === proxyPrefix ||
    url.startsWith(`${proxyPrefix}/`) ||
    url.startsWith(`${proxyPrefix}?`)
  );
}

function authorize(headers: Headers, url: string) {
  if (!isAmapProxyUrl(url) || headers.has("authorization")) return headers;
  const key = readOwnerKey();
  if (key) headers.set("Authorization", `Bearer ${key}`);
  return headers;
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function installNativeProxyAuth() {
  if (installed || !isNativeShell()) return;
  if (typeof XMLHttpRequest === "undefined" || typeof globalThis.fetch !== "function")
    return;
  installed = true;
  const originalFetch = globalThis.fetch.bind(globalThis);
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (!isAmapProxyUrl(url)) return originalFetch(input, init);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    authorize(headers, url);
    if (input instanceof Request)
      return originalFetch(new Request(input, { headers }), init);
    return originalFetch(input, { ...init, headers });
  }) as typeof fetch;

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    urls.set(this, String(url));
    originalOpen.call(this, method, url, async ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const url = urls.get(this);
    const key = url && isAmapProxyUrl(url) ? readOwnerKey() : "";
    if (key) originalSetHeader.call(this, "Authorization", `Bearer ${key}`);
    originalSend.call(this, body);
  };

  restore = () => {
    globalThis.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    installed = false;
    restore = null;
  };
}

export function resetNativeProxyAuthForTests() {
  restore?.();
  installed = false;
  restore = null;
}
