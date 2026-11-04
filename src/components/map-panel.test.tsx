import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapPanel } from "@/components/map-panel";
import { db } from "@/db/database";
import type { TimelineEntry } from "@/domain/types";

vi.mock("@/components/amap-canvas", () => ({
  AmapCanvas: ({ polyline }: { polyline: string }) => <div data-testid="map-polyline">{polyline}</div>,
}));

const item: TimelineEntry = {
  id: "item-1",
  dayId: "day-1",
  kind: "place",
  refId: "place-1",
  name: "清水寺",
  area: "东山",
  note: "",
  timeLabel: "09:30",
  locked: false,
  order: 0,
  mapSource: "unverified",
};

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.mapRoutes.clear();
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

describe("地图面板", () => {
  it("未核实时不显示距离，密钥缺失时说明未配置", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "not_configured" }), { status: 501 })),
    );
    render(
      <MapPanel
        tripId="trip-1"
        destination="京都"
        items={[item]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/未核实/)).toBeInTheDocument();
    expect(screen.queryByText(/米/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "展开地图" }));
    expect(await screen.findByText("高德密钥还没配置。")).toBeInTheDocument();
  });

  it("依次核实驾车、公交、步行后，三种结果都留在路段上", async () => {
    const replies: Record<string, { distanceMeters: number; durationSeconds: number; polyline: string }> = {
      driving: { distanceMeters: 2629, durationSeconds: 480, polyline: "120.10,30.20;120.12,30.22" },
      transit: { distanceMeters: 3327, durationSeconds: 2159, polyline: "" },
      walking: { distanceMeters: 3100, durationSeconds: 2400, polyline: "120.10,30.20;120.18,30.28" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.includes("/api/map/config")) {
          return json({ key: "js-key", serviceHost: "/_AMapService", version: "2.0" });
        }
        if (url.includes("/api/map/geocode")) return json({ citycode: "0571" });
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
        tripId="trip-modes"
        destination="杭州"
        items={[stop("from", "白堤", 120.1), stop("to", "湖滨小馆", 120.2)]}
        selectedId="from"
        onSelect={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "展开地图" }));
    expect(await screen.findByTestId("map-polyline")).toHaveTextContent("");

    await userEvent.click(screen.getByRole("button", { name: "核实驾车" }));
    expect(await screen.findByRole("button", { name: "驾车 2629 米 · 8 分钟" })).toBeInTheDocument();
    expect(screen.getByTestId("map-polyline")).toHaveTextContent("120.10,30.20;120.12,30.22");

    await userEvent.click(screen.getByRole("button", { name: "核实公交" }));
    expect(await screen.findByRole("button", { name: "公交 3327 米 · 36 分钟 · 公交线路无轨迹" })).toBeInTheDocument();
    expect(screen.getByText("公交线路无轨迹")).toBeInTheDocument();
    expect(screen.getByTestId("map-polyline")).toHaveTextContent("");
    expect(screen.getByRole("button", { name: "驾车 2629 米 · 8 分钟" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "核实步行" }));
    expect(await screen.findByRole("button", { name: "步行 3100 米 · 40 分钟" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "驾车 2629 米 · 8 分钟" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "公交 3327 米 · 36 分钟 · 公交线路无轨迹" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "核实步行" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("map-polyline")).toHaveTextContent("120.10,30.20;120.18,30.28");

    await userEvent.click(screen.getByRole("button", { name: "驾车 2629 米 · 8 分钟" }));
    expect(screen.getByRole("button", { name: "核实驾车" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("map-polyline")).toHaveTextContent("120.10,30.20;120.12,30.22");
  });
});
