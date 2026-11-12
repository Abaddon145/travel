/**
 * postMessage contract between the Capacitor shell and the HTTPS map page.
 * Payloads are markers and the current route only. No owner key, no trip body.
 */

import {
  isShellOrigin,
  legacyShellOrigin,
  shellOrigin,
  workerOrigin,
} from "./shell-origin.ts";

export const mapFrameProtocol = "lvxu-map-frame";
export const mapFrameVersion = 1;
export const mapFramePath = "/map-frame";
export const mapFrameDocument = "/map-frame.html";
export const mapFrameTokenHeader = "x-lvxu-map-token";
export const mapFrameMarker = "lvxu-map-frame";

export const basemapUnavailableCopy =
  "底图没有加载。地点和路线仍可使用；若它们已经显示，多半是高德没有接受当前页面来源。";

const idPattern = /^[A-Za-z0-9:_-]{1,160}$/;
const colorPattern = /^#[0-9a-fA-F]{6}$/;
const badgePattern = /^[0-9]{1,4}$/;
const tokenPattern = /^[0-9]{10,12}\.[0-9a-f]{64}$/;
const modes = new Set(["walking", "driving", "transit"]);

const maxPoints = 80;
const maxLines = 40;
const maxLabel = 80;
const maxPolyline = 120_000;

export type MapFrameMode = "walking" | "driving" | "transit";

export type MapFramePoint = {
  id: string;
  lng: number;
  lat: number;
  label: string;
  color: string;
  badge: string;
};

export type MapFrameLine = {
  id: string;
  polyline: string;
  color: string;
  mode: MapFrameMode;
};

export type MapFrameState = {
  points: MapFramePoint[];
  lines: MapFrameLine[];
  selectedId: string | null;
};

export type MapFrameCommand =
  | {
      protocol: typeof mapFrameProtocol;
      version: typeof mapFrameVersion;
      type: "auth";
      token: string;
    }
  | {
      protocol: typeof mapFrameProtocol;
      version: typeof mapFrameVersion;
      type: "state";
      state: MapFrameState;
      dark: boolean;
    };

export type MapFrameFault = "auth" | "basemap" | "unavailable";

export type MapFrameEvent =
  | {
      protocol: typeof mapFrameProtocol;
      version: typeof mapFrameVersion;
      type: "ready";
    }
  | {
      protocol: typeof mapFrameProtocol;
      version: typeof mapFrameVersion;
      type: "select";
      id: string;
    }
  | {
      protocol: typeof mapFrameProtocol;
      version: typeof mapFrameVersion;
      type: "fault";
      reason: MapFrameFault;
    };

export type MapFramePort = {
  postMessage: (message: unknown, targetOrigin: string) => void;
};

export function mapFrameUrl() {
  return `${workerOrigin}${mapFramePath}`;
}

export function isMapFramePath(pathname: string) {
  return pathname === mapFramePath || pathname === mapFrameDocument;
}

export function isMapFrameToken(value: string) {
  return tokenPattern.test(value);
}

export function mapFrameDocumentMarker(html: string) {
  return new RegExp(`name=["']${mapFrameMarker}["']`).test(html);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readable(value: string, max: number) {
  if (value.length > max) return false;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return false;
  }
  return !value.includes("<") && !value.includes(">");
}

function envelope(value: Record<string, unknown>) {
  return value.protocol === mapFrameProtocol && value.version === mapFrameVersion;
}

function parsePoint(value: unknown): MapFramePoint | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !idPattern.test(value.id)) return null;
  if (typeof value.lng !== "number" || !Number.isFinite(value.lng)) return null;
  if (typeof value.lat !== "number" || !Number.isFinite(value.lat)) return null;
  if (value.lng < -180 || value.lng > 180 || value.lat < -90 || value.lat > 90)
    return null;
  if (typeof value.label !== "string" || !readable(value.label, maxLabel)) return null;
  if (typeof value.color !== "string" || !colorPattern.test(value.color)) return null;
  if (typeof value.badge !== "string" || !badgePattern.test(value.badge)) return null;
  return {
    id: value.id,
    lng: value.lng,
    lat: value.lat,
    label: value.label,
    color: value.color,
    badge: value.badge,
  };
}

function parseLine(value: unknown): MapFrameLine | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !idPattern.test(value.id)) return null;
  if (typeof value.polyline !== "string") return null;
  if (value.polyline.length < 3 || value.polyline.length > maxPolyline) return null;
  if (!readable(value.polyline, maxPolyline)) return null;
  if (typeof value.color !== "string" || !colorPattern.test(value.color)) return null;
  if (typeof value.mode !== "string" || !modes.has(value.mode)) return null;
  return {
    id: value.id,
    polyline: value.polyline,
    color: value.color,
    mode: value.mode as MapFrameMode,
  };
}

export function parseMapFrameState(value: unknown): MapFrameState | null {
  if (!isRecord(value) || !Array.isArray(value.points) || !Array.isArray(value.lines)) {
    return null;
  }
  if (value.points.length > maxPoints || value.lines.length > maxLines) return null;
  const points: MapFramePoint[] = [];
  for (const point of value.points) {
    const parsed = parsePoint(point);
    if (!parsed) return null;
    points.push(parsed);
  }
  const lines: MapFrameLine[] = [];
  for (const line of value.lines) {
    const parsed = parseLine(line);
    if (!parsed) return null;
    lines.push(parsed);
  }
  const selectedId = value.selectedId;
  if (
    selectedId !== null &&
    (typeof selectedId !== "string" || !idPattern.test(selectedId))
  ) {
    return null;
  }
  return { points, lines, selectedId };
}

export function parseMapFrameCommand(
  data: unknown,
  origin: string,
): MapFrameCommand | null {
  if (!isShellOrigin(origin) || !isRecord(data) || !envelope(data)) return null;
  if (data.type === "auth") {
    if (typeof data.token !== "string" || !isMapFrameToken(data.token)) return null;
    return {
      protocol: mapFrameProtocol,
      version: mapFrameVersion,
      type: "auth",
      token: data.token,
    };
  }
  if (data.type === "state") {
    const state = parseMapFrameState(data.state);
    if (!state || typeof data.dark !== "boolean") return null;
    return {
      protocol: mapFrameProtocol,
      version: mapFrameVersion,
      type: "state",
      state,
      dark: data.dark,
    };
  }
  return null;
}

export function parseMapFrameEvent(data: unknown, origin: string): MapFrameEvent | null {
  if (origin !== workerOrigin || !isRecord(data) || !envelope(data)) return null;
  if (data.type === "ready") {
    return { protocol: mapFrameProtocol, version: mapFrameVersion, type: "ready" };
  }
  if (data.type === "select") {
    if (typeof data.id !== "string" || !idPattern.test(data.id)) return null;
    return {
      protocol: mapFrameProtocol,
      version: mapFrameVersion,
      type: "select",
      id: data.id,
    };
  }
  if (data.type === "fault") {
    if (
      data.reason !== "auth" &&
      data.reason !== "basemap" &&
      data.reason !== "unavailable"
    ) {
      return null;
    }
    return {
      protocol: mapFrameProtocol,
      version: mapFrameVersion,
      type: "fault",
      reason: data.reason,
    };
  }
  return null;
}

export function postToMapFrame(port: MapFramePort, message: MapFrameCommand) {
  port.postMessage(message, workerOrigin);
}

export function postToShell(port: MapFramePort, origin: string, message: MapFrameEvent) {
  if (!isShellOrigin(origin)) return false;
  port.postMessage(message, origin);
  return true;
}

export function announceMapFrameReady(port: MapFramePort) {
  const message: MapFrameEvent = {
    protocol: mapFrameProtocol,
    version: mapFrameVersion,
    type: "ready",
  };
  port.postMessage(message, shellOrigin);
  port.postMessage(message, legacyShellOrigin);
}
