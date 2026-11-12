import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { mapFrameUrl } from "@shared/map-frame";
import { workerOrigin } from "@shared/shell-origin";
import { MapPanel } from "@/components/map-panel";
import { clearOwnerKey, saveOwnerKey } from "@/lib/owner-key";

vi.mock("@/components/amap-canvas", () => ({
  AmapCanvas: () => <div data-testid="web-amap-canvas" />,
}));

const token = `${"1".repeat(10)}.${"ab".repeat(32)}`;

afterEach(() => {
  clearOwnerKey();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function days() {
  return [
    {
      id: "day-1",
      title: "第一天",
      date: "2026-11-14",
      items: [
        {
          id: "place-1",
          dayId: "day-1",
          kind: "place" as const,
          refId: "place-1",
          name: "灵隐寺",
          area: "",
          note: "",
          timeLabel: "",
          locked: false,
          order: 0,
          mapSource: "amap" as const,
          amapLng: 120.1,
          amapLat: 30.2,
        },
      ],
    },
  ];
}

describe("网页与壳的地图路径", () => {
  it("网页版仍直接渲染底图，不嵌地图页", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/map/config")) {
        return Response.json({
          key: "js-key",
          serviceHost: "/_AMapService",
          version: "2.0",
        });
      }
      return Response.json({ error: "not_found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MapPanel
        tripId="trip-web"
        destination="杭州"
        days={days()}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "展开地图" }));
    expect(await screen.findByTestId("web-amap-canvas")).toBeInTheDocument();
    expect(screen.queryByTitle("行程地图")).not.toBeInTheDocument();
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toContain("/api/map/config");
    expect(urls.some((url) => url.includes("frame-token"))).toBe(false);
    expect(urls.some((url) => url.startsWith("https://"))).toBe(false);
  });

  it("原生壳只嵌 HTTPS 地图页，不把行程交给线上整页", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    saveOwnerKey("device-key");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/map/config")) {
        return Response.json({
          key: "js-key",
          serviceHost: "/_AMapService",
          version: "2.0",
        });
      }
      if (url.includes("/api/map/frame-token")) {
        return Response.json({ token, expiresAt: Date.now() + 10 * 60 * 1000 });
      }
      return Response.json({ error: "not_found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MapPanel
        tripId="trip-native"
        destination="杭州"
        days={days()}
        selectedId="place-1"
        onSelect={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "展开地图" }));
    const iframe = (await screen.findByTitle("行程地图")) as HTMLIFrameElement;
    expect(iframe.src).toBe(mapFrameUrl());
    expect(iframe.src).toBe(`${workerOrigin}/map-frame`);
    expect(iframe.src).not.toContain("device-key");
    expect(iframe.src).not.toContain("灵隐寺");
    expect(screen.queryByTestId("web-amap-canvas")).not.toBeInTheDocument();
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls).toContain(`${workerOrigin}/api/map/config`);
    expect(urls).toContain(`${workerOrigin}/api/map/frame-token`);
    expect(screen.getByRole("button", { name: /灵隐寺/ })).toBeInTheDocument();
  });
});
