import { Capacitor } from "@capacitor/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { workerOrigin } from "@shared/shell-origin";
import { amapServiceHost, resolveApiPath } from "@/lib/api-origin";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("接口地址", () => {
  it("网页版保持相对路径和当前源", () => {
    expect(resolveApiPath("/api/status")).toBe("/api/status");
    expect(resolveApiPath("/api/map/config")).toBe("/api/map/config");
    expect(amapServiceHost()).toBe(`${window.location.origin}/_AMapService`);
  });

  it("原生壳改走 Worker", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    expect(resolveApiPath("/api/ai/itinerary")).toBe(`${workerOrigin}/api/ai/itinerary`);
    expect(amapServiceHost()).toBe(`${workerOrigin}/_AMapService`);
  });
});
