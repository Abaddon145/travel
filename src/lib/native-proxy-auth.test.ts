import { Capacitor } from "@capacitor/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workerOrigin } from "@shared/shell-origin";
import { clearOwnerKey, saveOwnerKey } from "@/lib/owner-key";
import {
  installNativeProxyAuth,
  isAmapProxyUrl,
  resetNativeProxyAuthForTests,
} from "@/lib/native-proxy-auth";

afterEach(() => {
  resetNativeProxyAuthForTests();
  clearOwnerKey();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("壳内地图代理鉴权头", () => {
  it("只认 Worker 上的地图代理", () => {
    expect(isAmapProxyUrl(`${workerOrigin}/_AMapService/v3/geocode/geo`)).toBe(true);
    expect(isAmapProxyUrl(`${workerOrigin}/_AMapService`)).toBe(true);
    expect(isAmapProxyUrl(`${workerOrigin}/api/map/config`)).toBe(false);
    expect(isAmapProxyUrl(`${workerOrigin}.evil.example/_AMapService`)).toBe(false);
    expect(isAmapProxyUrl("https://restapi.amap.com/v3/geocode/geo")).toBe(false);
  });

  it("网页版不改写请求", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    saveOwnerKey("device-key");
    const inner = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response("ok"));
    vi.stubGlobal("fetch", inner);
    installNativeProxyAuth();
    await fetch(`${workerOrigin}/_AMapService/v3/geocode/geo`);
    expect(inner.mock.calls[0]?.[1]).toBeUndefined();
  });

  it("原生壳只给地图代理补上私人密钥", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    saveOwnerKey("device-key");
    const inner = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => new Response("ok"));
    vi.stubGlobal("fetch", inner);
    const setHeader = vi.spyOn(XMLHttpRequest.prototype, "setRequestHeader");
    installNativeProxyAuth();

    await fetch(`${workerOrigin}/_AMapService/v3/geocode/geo?address=京都`);
    const headers = new Headers(
      (inner.mock.calls[0]?.[1] as RequestInit | undefined)?.headers,
    );
    expect(headers.get("authorization")).toBe("Bearer device-key");

    await fetch("https://api.open-meteo.com/v1/forecast");
    expect(inner.mock.calls[1]?.[1]).toBeUndefined();

    await fetch("/api/status");
    expect(inner.mock.calls[2]?.[1]).toBeUndefined();

    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${workerOrigin}/_AMapService/v5/place/text`);
    try {
      xhr.send();
    } catch {
      // jsdom has no map server. The header is attached before send.
    }
    expect(setHeader).toHaveBeenCalledWith("Authorization", "Bearer device-key");
  });
});
