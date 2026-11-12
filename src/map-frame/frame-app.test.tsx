import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mapFrameTokenHeader } from "@shared/map-frame";
import { legacyShellOrigin, shellOrigin, workerOrigin } from "@shared/shell-origin";
import { MapFrameApp } from "@/map-frame/frame-app";
import { resetMapFrameProxyAuthForTests } from "@/lib/map-frame-auth";
import { clearOwnerKey, saveOwnerKey } from "@/lib/owner-key";

vi.mock("@/components/amap-canvas", () => ({
  AmapCanvas: ({
    onSelect,
    points,
  }: {
    onSelect: (id: string) => void;
    points: { id: string; label: string }[];
  }) => (
    <button type="button" onClick={() => onSelect(points[0]?.id ?? "")}>
      {points[0]?.label ?? "地图"}
    </button>
  ),
}));

const token = `${"1".repeat(10)}.${"ef".repeat(32)}`;
const parentDescriptor = Object.getOwnPropertyDescriptor(window, "parent");

const point = {
  id: "place-1",
  lng: 120.1,
  lat: 30.2,
  label: "灵隐寺",
  color: "#8c4a32",
  badge: "1",
};

function embed(postMessage = vi.fn()) {
  const parent = { postMessage };
  Object.defineProperty(window, "parent", { configurable: true, value: parent });
  return parent;
}

function restoreParent() {
  if (parentDescriptor) Object.defineProperty(window, "parent", parentDescriptor);
}

afterEach(() => {
  restoreParent();
  resetMapFrameProxyAuthForTests();
  clearOwnerKey();
  vi.unstubAllGlobals();
});

describe("HTTPS 地图页", () => {
  it("单独打开时不请求地图", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<MapFrameApp />);
    expect(screen.getByText("这页只在旅序的行程地图里使用。")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("只接受壳源，用令牌向 Worker 取钥匙，再把选择发回该壳", async () => {
    saveOwnerKey("device-key");
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => Response.json({ key: "js-key", serviceHost: "/_AMapService" }));
    vi.stubGlobal("fetch", fetchMock);
    const parent = embed();
    render(<MapFrameApp />);

    await waitFor(() => expect(parent.postMessage).toHaveBeenCalled());
    const readyTargets = parent.postMessage.mock.calls.map((call) => call[1]);
    expect(readyTargets).toContain(shellOrigin);
    expect(readyTargets).toContain(legacyShellOrigin);
    expect(readyTargets).not.toContain("*");
    expect(readyTargets).not.toContain(workerOrigin);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { protocol: "lvxu-map-frame", version: 1, type: "auth", token },
        origin: workerOrigin,
        source: window.parent,
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { protocol: "lvxu-map-frame", version: 1, type: "auth", token },
        origin: shellOrigin,
        source: window.parent,
      }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/map/config");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get(mapFrameTokenHeader)).toBe(token);
    expect(headers.get("authorization")).toBeNull();
    expect(init.credentials).toBe("omit");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocol: "lvxu-map-frame",
          version: 1,
          type: "state",
          dark: true,
          state: { points: [point], lines: [], selectedId: point.id },
        },
        origin: shellOrigin,
        source: window.parent,
      }),
    );
    expect(await screen.findByRole("button", { name: "灵隐寺" })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
    parent.postMessage.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "灵隐寺" }));
    expect(parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "select", id: "place-1" }),
      shellOrigin,
    );
    expect(parent.postMessage).not.toHaveBeenCalledWith(
      expect.anything(),
      legacyShellOrigin,
    );
    expect(parent.postMessage).not.toHaveBeenCalledWith(expect.anything(), "*");
  });
});
