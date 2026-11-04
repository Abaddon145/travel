import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapPanel } from "@/components/map-panel";
import type { TimelineEntry } from "@/domain/types";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

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
});
