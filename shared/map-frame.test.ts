// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { legacyShellOrigin, shellOrigin, workerOrigin } from "./shell-origin.ts";
import {
  announceMapFrameReady,
  basemapUnavailableCopy,
  isMapFramePath,
  isMapFrameToken,
  mapFrameDocumentMarker,
  mapFrameUrl,
  parseMapFrameCommand,
  parseMapFrameEvent,
  parseMapFrameState,
  postToMapFrame,
  postToShell,
} from "./map-frame.ts";

const token = `${"1".repeat(10)}.${"ab".repeat(32)}`;

const point = {
  id: "11111111-1111-4111-8111-111111111111",
  lng: 120.1,
  lat: 30.2,
  label: "灵隐寺",
  color: "#8c4a32",
  badge: "1",
};

const line = {
  id: `${point.id}:${point.id}:walking`,
  polyline: "120.10,30.20;120.12,30.22",
  color: "#3f6b58",
  mode: "walking",
};

describe("地图页协议", () => {
  it("只接受壳源的指令，并且只把事件交回地图页源", () => {
    const auth = { protocol: "lvxu-map-frame", version: 1, type: "auth", token };
    expect(parseMapFrameCommand(auth, shellOrigin)?.type).toBe("auth");
    expect(parseMapFrameCommand(auth, legacyShellOrigin)?.type).toBe("auth");
    expect(parseMapFrameCommand(auth, workerOrigin)).toBeNull();
    expect(parseMapFrameCommand(auth, "capacitor://evil.example")).toBeNull();
    expect(parseMapFrameCommand(auth, "https://evil.example")).toBeNull();
    expect(parseMapFrameCommand({ ...auth, version: 2 }, shellOrigin)).toBeNull();
    expect(
      parseMapFrameCommand({ ...auth, token: "device-key" }, shellOrigin),
    ).toBeNull();

    const select = {
      protocol: "lvxu-map-frame",
      version: 1,
      type: "select",
      id: point.id,
    };
    expect(parseMapFrameEvent(select, workerOrigin)?.type).toBe("select");
    expect(parseMapFrameEvent(select, shellOrigin)).toBeNull();
    expect(parseMapFrameEvent(select, `${workerOrigin}.evil`)).toBeNull();
    expect(parseMapFrameEvent({ ...select, id: "<script>" }, workerOrigin)).toBeNull();
  });

  it("状态只保留标记、选中项和当前路线", () => {
    const state = parseMapFrameState({
      points: [point, { ...point, badge: "<b>1</b>" }],
      lines: [line],
      selectedId: point.id,
    });
    expect(state).toBeNull();

    const ok = parseMapFrameState({
      points: [point],
      lines: [line],
      selectedId: point.id,
      ownerKey: "device-key",
    });
    expect(ok).toEqual({ points: [point], lines: [line], selectedId: point.id });
    expect(JSON.stringify(ok)).not.toContain("device-key");
    expect(line.id.length).toBeGreaterThan(80);

    const command = parseMapFrameCommand(
      { protocol: "lvxu-map-frame", version: 1, type: "state", state: ok, dark: true },
      shellOrigin,
    );
    expect(command).toMatchObject({ type: "state", dark: true });
    expect(
      parseMapFrameState({
        points: [point],
        lines: [{ ...line, color: "red" }],
        selectedId: null,
      }),
    ).toBeNull();
    expect(
      parseMapFrameState({
        points: [{ ...point, lng: 999 }],
        lines: [],
        selectedId: null,
      }),
    ).toBeNull();
  });

  it("发送时钉死目标源，不使用星号", () => {
    const port = { postMessage: vi.fn() };
    postToMapFrame(port, {
      protocol: "lvxu-map-frame",
      version: 1,
      type: "auth",
      token,
    });
    expect(port.postMessage).toHaveBeenCalledWith(expect.anything(), workerOrigin);
    expect(
      postToShell(port, workerOrigin, {
        protocol: "lvxu-map-frame",
        version: 1,
        type: "ready",
      }),
    ).toBe(false);
    expect(
      postToShell(port, shellOrigin, {
        protocol: "lvxu-map-frame",
        version: 1,
        type: "ready",
      }),
    ).toBe(true);
    port.postMessage.mockClear();
    announceMapFrameReady(port);
    const targets = port.postMessage.mock.calls.map((call) => call[1]);
    expect(targets).toContain(shellOrigin);
    expect(targets).toContain(legacyShellOrigin);
    expect(targets).not.toContain("*");
    expect(targets).not.toContain(workerOrigin);
    expect(mapFrameUrl()).toBe(`${workerOrigin}/map-frame`);
    expect(isMapFramePath("/map-frame")).toBe(true);
    expect(isMapFramePath("/map-frame.html")).toBe(true);
    expect(isMapFramePath("/map-frame-other")).toBe(false);
    expect(isMapFramePath("/")).toBe(false);
    expect(isMapFrameToken(token)).toBe(true);
    expect(isMapFrameToken("device-key")).toBe(false);
    expect(mapFrameDocumentMarker('<meta name="lvxu-map-frame" content="1" />')).toBe(
      true,
    );
    expect(mapFrameDocumentMarker("<html></html>")).toBe(false);
    expect(basemapUnavailableCopy).toContain("底图没有加载");
  });
});
