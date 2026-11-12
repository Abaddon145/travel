import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  basemapUnavailableCopy,
  mapFrameProtocol,
  mapFrameUrl,
  mapFrameVersion,
  parseMapFrameEvent,
  parseMapFrameState,
  postToMapFrame,
  type MapFrameLine,
  type MapFramePoint,
  type MapFrameState,
} from "@shared/map-frame";
import type { MapLine, MapPoint } from "@/components/amap-canvas";
import { loadMapFrameToken } from "@/lib/map-frame-client";

const loadTimeoutMs = 12_000;
const refreshLeadMs = 60_000;

function framePoint(point: MapPoint): MapFramePoint {
  return {
    id: point.id,
    lng: point.lng,
    lat: point.lat,
    label: point.label,
    color: point.color,
    badge: point.badge,
  };
}

function frameLine(line: MapLine): MapFrameLine | null {
  if (line.mode !== "walking" && line.mode !== "driving" && line.mode !== "transit")
    return null;
  return { id: line.id, polyline: line.polyline, color: line.color, mode: line.mode };
}

function frameState(
  points: MapPoint[],
  lines: MapLine[],
  selectedId: string | null,
): MapFrameState {
  const parsed = parseMapFrameState({
    points: points.map(framePoint),
    lines: lines.flatMap((line) => {
      const framed = frameLine(line);
      return framed ? [framed] : [];
    }),
    selectedId,
  });
  return parsed ?? { points: [], lines: [], selectedId: null };
}

export function MapFrameHost({
  points,
  lines,
  selectedId,
  onSelect,
}: {
  points: MapPoint[];
  lines: MapLine[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const onSelectRef = useRef(onSelect);
  const [token, setToken] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [booted, setBooted] = useState(false);
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const state = useMemo(
    () => frameState(points, lines, selectedId),
    [lines, points, selectedId],
  );
  const signature = JSON.stringify(state);
  const tokenRef = useRef(token);
  const stateRef = useRef(state);
  const darkRef = useRef(dark);
  useEffect(() => {
    tokenRef.current = token;
    stateRef.current = state;
    darkRef.current = dark;
  });

  const publish = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    const current = tokenRef.current;
    if (!win || !current) return;
    postToMapFrame(win, {
      protocol: mapFrameProtocol,
      version: mapFrameVersion,
      type: "auth",
      token: current,
    });
    postToMapFrame(win, {
      protocol: mapFrameProtocol,
      version: mapFrameVersion,
      type: "state",
      state: stateRef.current,
      dark: darkRef.current,
    });
  }, []);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => setDark(root.classList.contains("dark"));
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadMapFrameToken().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setToken(result.token);
      setExpiresAt(result.expiresAt);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || !expiresAt) return undefined;
    const delay = Math.max(5_000, expiresAt - Date.now() - refreshLeadMs);
    const timer = window.setTimeout(() => {
      void loadMapFrameToken().then((result) => {
        if (!result.ok) return;
        setToken(result.token);
        setExpiresAt(result.expiresAt);
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [expiresAt, token]);

  useEffect(() => {
    publish();
  }, [booted, dark, publish, signature, token]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || !token) return undefined;
    const fail = () => setFailed(true);
    node.addEventListener("error", fail);
    return () => node.removeEventListener("error", fail);
  }, [token]);

  useEffect(() => {
    if (!token || failed || booted) return undefined;
    const timer = window.setTimeout(() => setFailed(true), loadTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [booted, failed, token]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const parsed = parseMapFrameEvent(event.data, event.origin);
      if (!parsed) return;
      if (parsed.type === "ready") {
        setBooted(true);
        publish();
        return;
      }
      if (parsed.type === "select") onSelectRef.current(parsed.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [publish]);

  if (failed) {
    return (
      <p className="px-3 py-6 text-sm leading-6" data-testid="map-frame-fallback">
        {basemapUnavailableCopy}
      </p>
    );
  }
  if (!token) {
    return <p className="px-3 py-6 text-sm">正在加载地图。</p>;
  }
  return (
    <iframe
      ref={frameRef}
      title="行程地图"
      src={mapFrameUrl()}
      className="h-full w-full border-0 bg-card"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={publish}
      onError={() => setFailed(true)}
    />
  );
}
