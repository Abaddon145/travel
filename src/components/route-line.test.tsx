import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AmapCanvas } from "@/components/amap-canvas";
import { MapPanel } from "@/components/map-panel";
import { overviewFitPadding, parseAmapPath, routeFitPadding, routeStroke } from "@/lib/amap-path";
import { db } from "@/db/database";
import type { TimelineEntry } from "@/domain/types";

type LineOptions = {
  path: Array<{ lng: number; lat: number }>;
  strokeColor: string;
  strokeOpacity: number;
  strokeWeight: number;
  zIndex: number;
};

const recorded = vi.hoisted(() => ({
  lines: [] as Array<{ options: LineOptions }>,
  fits: [] as Array<{ overlays: unknown[]; padding?: number[] }>,
}));

vi.mock("@amap/amap-jsapi-loader", () => {
  class LngLat {
    lng: number;
    lat: number;
    constructor(lng: number, lat: number) {
      this.lng = lng;
      this.lat = lat;
    }
  }
  class Polyline {
    options: LineOptions;
    constructor(options: LineOptions) {
      this.options = options;
      recorded.lines.push(this);
    }
  }
  class Marker {
    on() {
      return undefined;
    }
  }
  class Pixel {
    constructor(x: number, y: number) {
      void x;
      void y;
    }
  }
  class Map {
    add() {
      return undefined;
    }
    remove() {
      return undefined;
    }
    on(event: string, handler: () => void) {
      if (event === "complete") handler();
    }
    setFitView(overlays?: unknown[], _immediately?: boolean, padding?: number[]) {
      recorded.fits.push({ overlays: overlays ?? [], padding });
    }
    destroy() {
      return undefined;
    }
  }
  return {
    default: {
      load: async () => ({ Map, Marker, Polyline, LngLat, Pixel }),
    },
  };
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stop(id: string, name: string, lng: number): TimelineEntry {
  return {
    id,
    dayId: "day-1",
    kind: "place",
    refId: id,
    name,
    area: "",
    note: "",
    timeLabel: "",
    locked: false,
    order: 0,
    mapSource: "amap",
    amapPoiId: `poi-${id}`,
    amapLng: lng,
    amapLat: 30.2,
  };
}

function coords(line: { options: LineOptions } | undefined) {
  return line?.options.path.map((point) => [point.lng, point.lat]);
}

afterEach(async () => {
  vi.unstubAllGlobals();
  recorded.lines.length = 0;
  recorded.fits.length = 0;
  await db.mapRoutes.where("tripId").equals("trip-line").delete();
  await db.routePicks.where("tripId").equals("trip-line").delete();
});

const points = [
  { id: "a", lng: 120.1, lat: 30.2, label: "白堤" },
  { id: "b", lng: 120.16, lat: 30.26, label: "湖滨" },
];

describe("地图折线", () => {
  it("选中折线时贴合路线，没有选中时回到总览", async () => {
    const view = render(<AmapCanvas apiKey="js-key" points={points} polyline="" onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(recorded.fits.at(-1)?.overlays).toHaveLength(2);
      expect(recorded.fits.at(-1)?.padding).toEqual(overviewFitPadding);
    });
    view.rerender(
      <AmapCanvas apiKey="js-key" points={points} polyline="120.10,30.20;120.12,30.22" onSelect={vi.fn()} />,
    );
    await waitFor(() => {
      expect(recorded.fits.at(-1)?.overlays).toEqual([recorded.lines.at(-1)]);
      expect(recorded.fits.at(-1)?.padding).toEqual(routeFitPadding);
    });
    view.rerender(<AmapCanvas apiKey="js-key" points={points} polyline="" onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(recorded.fits.at(-1)?.overlays).toHaveLength(2);
      expect(recorded.fits.at(-1)?.padding).toEqual(overviewFitPadding);
    });
  });

  it("按经度、纬度解析高德坐标串", () => {
    expect(parseAmapPath("120.15,30.26;bad;120.16,30.27;120.16,30.27")).toEqual([
      [120.15, 30.26],
      [120.16, 30.27],
    ]);
  });

  it("丢掉越界坐标，避免把地图拉出范围", () => {
    expect(parseAmapPath("200,10;120,95;-181,30;120.1,30.2")).toEqual([[120.1, 30.2]]);
  });

  it("选中的方式会画成一条高德折线", async () => {
    const replies: Record<string, { distanceMeters: number; durationSeconds: number; polyline: string }> = {
      driving: {
        distanceMeters: 2629,
        durationSeconds: 480,
        polyline: "120.10,30.20;120.11,30.21;120.12,30.22",
      },
      walking: {
        distanceMeters: 2218,
        durationSeconds: 1800,
        polyline: "120.10,30.20;120.18,30.28;120.19,30.29",
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.includes("/api/map/config")) {
          return json({ key: "js-key", serviceHost: "/_AMapService", version: "2.0" });
        }
        if (url.includes("/api/map/route")) {
          const mode = new URL(url, "http://lvxu.local").searchParams.get("mode") ?? "";
          const route = replies[mode];
          return json({ fetchedAt: Date.now(), route: { mode, ...route } });
        }
        return json({ error: "not_found" }, 404);
      }),
    );

    render(
      <MapPanel
        tripId="trip-line"
        destination="杭州"
        items={[stop("from", "白堤", 120.1), stop("to", "湖滨小馆", 120.16)]}
        selectedId="from"
        onSelect={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "展开地图" }));
    expect(await screen.findByTestId("amap-canvas")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "核实驾车" }));
    await waitFor(() => {
      expect(coords(recorded.lines.at(-1))).toEqual([
        [120.1, 30.2],
        [120.11, 30.21],
        [120.12, 30.22],
      ]);
    });
    const driving = recorded.lines.at(-1);
    expect(driving?.options).toMatchObject({
      strokeColor: routeStroke,
      strokeOpacity: 1,
      strokeWeight: 6,
      zIndex: 120,
    });
    expect(recorded.fits.at(-1)?.overlays).toEqual([driving]);
    expect(recorded.fits.at(-1)?.padding).toEqual(routeFitPadding);

    await userEvent.click(screen.getByRole("button", { name: "核实步行" }));
    await waitFor(() => {
      expect(coords(recorded.lines.at(-1))).toEqual([
        [120.1, 30.2],
        [120.18, 30.28],
        [120.19, 30.29],
      ]);
    });
    await userEvent.click(screen.getByRole("button", { name: "驾车 2629 米 · 8 分钟" }));
    await waitFor(() => {
      expect(coords(recorded.lines.at(-1))).toEqual([
        [120.1, 30.2],
        [120.11, 30.21],
        [120.12, 30.22],
      ]);
    });
  });
});
