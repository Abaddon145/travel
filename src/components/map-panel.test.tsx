import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapPanel } from "@/components/map-panel";
import { db } from "@/db/database";
import { saveMapRoute, saveRoutePick } from "@/db/repository";
import type { TimelineEntry } from "@/domain/types";

vi.mock("@/components/amap-canvas", () => ({
  AmapCanvas: ({ lines }: { lines: { polyline: string }[] }) => (
    <div data-testid="map-polyline">{lines.map((line) => line.polyline).join("|")}</div>
  ),
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
  sessionStorage.clear();
  await db.mapRoutes.clear();
  await db.routePicks.clear();
});

function asDays(items: TimelineEntry[], id = "day-1") {
  return [{ id, title: "第一天", date: "2026-11-12", items }];
}

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
        days={asDays([item])}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("map-summary")).toHaveTextContent("1 个地点 · 0 已核对");
    expect(screen.queryByRole("button", { name: "核对地点" })).not.toBeInTheDocument();
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
        days={asDays([stop("from", "白堤", 120.1), stop("to", "湖滨小馆", 120.2)])}
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
    expect(screen.getByRole("button", { name: "步行 3100 米 · 40 分钟" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "核实步行" })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByTestId("map-polyline")).toHaveTextContent("120.10,30.20;120.18,30.28");

    await userEvent.click(screen.getByRole("button", { name: "驾车 2629 米 · 8 分钟" }));
    expect(await screen.findByRole("button", { name: "驾车 2629 米 · 8 分钟" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "核实驾车" })).not.toHaveAttribute("aria-pressed");
    expect(screen.getByTestId("map-polyline")).toHaveTextContent("120.10,30.20;120.12,30.22");
  });

  it("重新打开后仍选中手动指定的方式，而不是最近一次核实", async () => {
    const now = Date.now();
    await saveMapRoute(db, {
      id: "from:to:driving",
      tripId: "trip-pick",
      fromItemId: "from",
      toItemId: "to",
      mode: "driving",
      ok: true,
      distanceMeters: 2629,
      durationSeconds: 480,
      polyline: "120.10,30.20;120.12,30.22",
      fetchedAt: now,
      fromPoiId: "poi-from",
      toPoiId: "poi-to",
    });
    await saveMapRoute(db, {
      id: "from:to:walking",
      tripId: "trip-pick",
      fromItemId: "from",
      toItemId: "to",
      mode: "walking",
      ok: true,
      distanceMeters: 2218,
      durationSeconds: 1800,
      polyline: "120.10,30.20;120.18,30.28",
      fetchedAt: now - 60_000,
      fromPoiId: "poi-from",
      toPoiId: "poi-to",
    });
    const props = {
      tripId: "trip-pick",
      destination: "杭州",
      days: asDays([stop("from", "白堤", 120.1), stop("to", "湖滨小馆", 120.16)]),
      selectedId: "from",
      onSelect: vi.fn(),
    };
    const view = render(<MapPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "展开地图" }));
    expect(await screen.findByRole("button", { name: "驾车 2629 米 · 8 分钟" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "步行 2218 米 · 30 分钟" }));
    expect(await screen.findByRole("button", { name: "步行 2218 米 · 30 分钟" })).toHaveAttribute("aria-pressed", "true");
    view.unmount();
    render(<MapPanel {...props} />);
    expect(await screen.findByRole("button", { name: "步行 2218 米 · 30 分钟" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "驾车 2629 米 · 8 分钟" })).toHaveAttribute("aria-pressed", "false");
    expect(await db.routePicks.get("from:to")).toMatchObject({ mode: "walking" });
  });

  it("按天编号，并且不给跨天路段核实按钮", async () => {
    render(
      <MapPanel
        tripId="trip-days"
        destination="京都"
        days={[
          { id: "day-a", title: "抵达", date: "2026-11-12", items: [stop("a", "白川庵", 135.7)] },
          { id: "day-b", title: "东山", date: "2026-11-13", items: [stop("b", "清水寺", 135.8)] },
        ]}
        selectedId="a"
        onSelect={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "展开地图" }));
    expect(screen.getByRole("button", { name: /1\. 白川庵/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\. 清水寺/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "核实步行" })).not.toBeInTheDocument();
  });

  it("重新打开后重画已保存的路线", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ key: "js-key", serviceHost: "/_AMapService", version: "2.0" })),
    );
    await saveMapRoute(db, {
      id: "from:to:walking",
      tripId: "trip-redraw",
      fromItemId: "from",
      toItemId: "to",
      mode: "walking",
      ok: true,
      distanceMeters: 860,
      durationSeconds: 720,
      polyline: "135.10,35.00;135.11,35.01",
      fetchedAt: Date.now(),
      fromPoiId: "poi-from",
      toPoiId: "poi-to",
    });
    await saveRoutePick(db, {
      id: "from:to",
      tripId: "trip-redraw",
      fromItemId: "from",
      toItemId: "to",
      mode: "walking",
    });
    render(
      <MapPanel
        tripId="trip-redraw"
        destination="京都"
        days={asDays([stop("from", "白川庵", 135.1), stop("to", "清水寺", 135.2)])}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "展开地图" }));
    expect(await screen.findByTestId("map-polyline")).toHaveTextContent("135.10,35.00;135.11,35.01");
  });
});
