import { afterEach, describe, expect, it, vi } from "vitest";
import { mapFrameTokenHeader } from "@shared/map-frame";
import { workerOrigin } from "@shared/shell-origin";
import {
  installMapFrameProxyAuth,
  isFrameProxyUrl,
  resetMapFrameProxyAuthForTests,
} from "@/lib/map-frame-auth";

const token = `${"1".repeat(10)}.${"cd".repeat(32)}`;

afterEach(() => {
  resetMapFrameProxyAuthForTests();
  vi.unstubAllGlobals();
});

describe("地图页代理鉴权", () => {
  it("只认当前页面上的地图代理", () => {
    expect(isFrameProxyUrl("/_AMapService/v3/geocode/geo")).toBe(true);
    expect(isFrameProxyUrl(`${window.location.origin}/_AMapService`)).toBe(true);
    expect(isFrameProxyUrl("/api/map/config")).toBe(false);
    expect(isFrameProxyUrl(`${workerOrigin}.evil.example/_AMapService`)).toBe(false);
    expect(isFrameProxyUrl("https://restapi.amap.com/v3/geocode/geo")).toBe(false);
  });

  it("只给地图代理补上短时令牌，不附私人密钥", async () => {
    const inner = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response("ok"));
    vi.stubGlobal("fetch", inner);
    const setHeader = vi.spyOn(XMLHttpRequest.prototype, "setRequestHeader");
    installMapFrameProxyAuth(token);

    await fetch("/_AMapService/v5/place/text?keywords=京都");
    const headers = new Headers(
      (inner.mock.calls[0]?.[1] as RequestInit | undefined)?.headers,
    );
    expect(headers.get(mapFrameTokenHeader)).toBe(token);
    expect(headers.get("authorization")).toBeNull();

    await fetch("/api/map/route");
    expect(
      (inner.mock.calls[1]?.[1] as RequestInit | undefined)?.headers,
    ).toBeUndefined();

    await fetch("https://webapi.amap.com/maps");
    expect(
      (inner.mock.calls[2]?.[1] as RequestInit | undefined)?.headers,
    ).toBeUndefined();

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/_AMapService/v3/log");
    try {
      xhr.send();
    } catch {
      // jsdom has no map server. The header is attached before send.
    }
    expect(setHeader).toHaveBeenCalledWith(mapFrameTokenHeader, token);
    expect(setHeader).not.toHaveBeenCalledWith("Authorization", expect.anything());
  });
});
