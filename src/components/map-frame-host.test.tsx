import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mapFrameUrl } from "@shared/map-frame";
import { workerOrigin } from "@shared/shell-origin";
import { MapFrameHost } from "@/components/map-frame-host";
import { saveOwnerKey, clearOwnerKey } from "@/lib/owner-key";

const token = `${"1".repeat(10)}.${"ab".repeat(32)}`;
const point = {
  id: "place-1",
  lng: 120.14,
  lat: 30.25,
  label: "灵隐寺",
  color: "#8c4a32",
  badge: "1",
  selected: true,
};

afterEach(() => {
  clearOwnerKey();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function tokenFetch() {
  return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () => Response.json({ token, expiresAt: Date.now() + 10 * 60 * 1000 }),
  );
}

describe("壳内地图框", () => {
  it("只向地图页发送标记和令牌，并忽略其它来源", async () => {
    saveOwnerKey("device-key");
    const fetchMock = tokenFetch();
    vi.stubGlobal("fetch", fetchMock);
    const onSelect = vi.fn();
    render(
      <MapFrameHost
        points={[point]}
        lines={[
          {
            id: "place-1:place-2:walking",
            polyline: "120.14,30.25;120.16,30.26",
            color: "#3f6b58",
            mode: "walking",
          },
        ]}
        selectedId="place-1"
        onSelect={onSelect}
      />,
    );

    const iframe = (await screen.findByTitle("行程地图")) as HTMLIFrameElement;
    expect(iframe.src).toBe(mapFrameUrl());
    expect(iframe.src).not.toContain("device-key");
    expect(iframe.src).not.toContain(token);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/map/frame-token");
    const requestHeaders = new Headers(
      (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers,
    );
    expect(requestHeaders.get("authorization")).toBe("Bearer device-key");

    const win = iframe.contentWindow;
    expect(win).toBeTruthy();
    const posted = vi.spyOn(win as Window, "postMessage");
    fireEvent.load(iframe);
    await waitFor(() => expect(posted).toHaveBeenCalled());
    expect(posted.mock.calls.every((call) => String(call.at(1)) === workerOrigin)).toBe(
      true,
    );
    const messages = posted.mock.calls.map((call) => call[0] as { type: string });
    expect(messages.some((message) => message.type === "auth")).toBe(true);
    expect(messages.some((message) => message.type === "state")).toBe(true);
    expect(JSON.stringify(messages)).toContain("灵隐寺");
    expect(JSON.stringify(messages)).toContain("walking");
    expect(JSON.stringify(messages)).not.toContain("device-key");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { protocol: "lvxu-map-frame", version: 1, type: "select", id: "place-1" },
        origin: "https://evil.example",
        source: win,
      }),
    );
    expect(onSelect).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { protocol: "lvxu-map-frame", version: 1, type: "select", id: "place-1" },
        origin: workerOrigin,
        source: win,
      }),
    );
    expect(onSelect).toHaveBeenCalledWith("place-1");
  });

  it("地图页打不开时在地图区域写出说明", async () => {
    vi.stubGlobal("fetch", tokenFetch());
    render(
      <MapFrameHost points={[point]} lines={[]} selectedId={null} onSelect={vi.fn()} />,
    );
    const iframe = await screen.findByTitle("行程地图");
    iframe.dispatchEvent(new Event("error"));
    expect(await screen.findByTestId("map-frame-fallback")).toHaveTextContent(
      "底图没有加载。地点和路线仍可使用；若它们已经显示，多半是高德没有接受当前页面来源。",
    );
    expect(screen.queryByTitle("行程地图")).not.toBeInTheDocument();
  });

  it("令牌接口失败时不嵌空白框", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 401 })),
    );
    render(
      <MapFrameHost points={[point]} lines={[]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(await screen.findByTestId("map-frame-fallback")).toBeInTheDocument();
    expect(screen.queryByTitle("行程地图")).not.toBeInTheDocument();
  });
});
