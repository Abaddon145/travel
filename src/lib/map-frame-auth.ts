import { mapFrameTokenHeader } from "@shared/map-frame";

const urls = new WeakMap<XMLHttpRequest, string>();

let token = "";
let installed = false;
let restore: (() => void) | null = null;

export function isFrameProxyUrl(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return false;
    return (
      parsed.pathname === "/_AMapService" || parsed.pathname.startsWith("/_AMapService/")
    );
  } catch {
    return false;
  }
}

function authorize(headers: Headers, url: string) {
  if (!isFrameProxyUrl(url) || !token) return headers;
  headers.set(mapFrameTokenHeader, token);
  return headers;
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function installMapFrameProxyAuth(next: string) {
  token = next;
  if (installed) return;
  if (typeof XMLHttpRequest === "undefined" || typeof globalThis.fetch !== "function")
    return;
  installed = true;
  const originalFetch = globalThis.fetch.bind(globalThis);
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (!isFrameProxyUrl(url) || !token) return originalFetch(input, init);
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
    if (url && isFrameProxyUrl(url) && token) {
      originalSetHeader.call(this, mapFrameTokenHeader, token);
    }
    originalSend.call(this, body);
  };

  restore = () => {
    globalThis.fetch = originalFetch;
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    installed = false;
    token = "";
    restore = null;
  };
}

export function resetMapFrameProxyAuthForTests() {
  restore?.();
  installed = false;
  token = "";
  restore = null;
}
