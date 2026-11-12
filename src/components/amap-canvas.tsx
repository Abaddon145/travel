import { useEffect, useRef, useState } from "react";
import { basemapUnavailableCopy } from "@shared/map-frame";
import { overviewFitPadding, parseAmapPath, routeFitPadding } from "@/lib/amap-path";
import { amapServiceHost } from "@/lib/api-origin";

type AmapMap = {
  add: (overlay: unknown) => void;
  remove: (overlay: unknown) => void;
  on: (event: string, handler: () => void) => void;
  setFitView: (overlays?: unknown[], immediately?: boolean, avoid?: number[]) => void;
  destroy: () => void;
};

type AmapNamespace = {
  Map: new (
    container: HTMLElement,
    options?: { zoom?: number; center?: [number, number] },
  ) => AmapMap;
  Marker: new (options: {
    position: [number, number];
    content?: string;
    offset?: unknown;
    zIndex?: number;
  }) => { on: (event: string, handler: () => void) => void };
  LngLat: new (lng: number, lat: number) => { lng: number; lat: number };
  Polyline: new (options: {
    path: unknown[];
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    zIndex: number;
    lineJoin: "round";
    lineCap: "round";
    showDir: boolean;
    isOutline: boolean;
    outlineColor: string;
    borderWeight: number;
  }) => unknown;
  Pixel: new (x: number, y: number) => unknown;
};

export type MapPoint = {
  id: string;
  lng: number;
  lat: number;
  label: string;
  color: string;
  badge: string;
  selected: boolean;
};

export type MapLine = {
  id: string;
  polyline: string;
  color: string;
  mode?: "walking" | "driving" | "transit";
};

export function AmapCanvas({
  apiKey,
  points,
  lines,
  onSelect,
  onLoadError,
}: {
  apiKey: string;
  points: MapPoint[];
  lines: MapLine[];
  onSelect: (id: string) => void;
  onLoadError?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const selectRef = useRef(onSelect);
  const loadErrorRef = useRef(onLoadError);
  const pointsRef = useRef(points);
  const linesRef = useRef(lines);
  const drawRef = useRef<() => void>(() => undefined);
  const pointsKey = points
    .map(
      (point) =>
        `${point.id}:${point.lng}:${point.lat}:${point.badge}:${point.color}:${point.selected}`,
    )
    .join("|");
  const linesKey = lines
    .map((line) => `${line.id}:${line.color}:${line.polyline}`)
    .join("|");

  useEffect(() => {
    selectRef.current = onSelect;
    loadErrorRef.current = onLoadError;
  }, [onLoadError, onSelect]);

  useEffect(() => {
    pointsRef.current = points;
    linesRef.current = lines;
  }, [points, lines]);

  useEffect(() => {
    const container = ref.current;
    if (!container || pointsRef.current.length === 0) return undefined;
    let cancelled = false;
    let map: AmapMap | null = null;
    setLoadError(false);

    window._AMapSecurityConfig = { serviceHost: amapServiceHost() };
    void import("@amap/amap-jsapi-loader")
      .then((module) =>
        module.default.load({
          key: apiKey,
          version: "2.0",
          plugins: ["AMap.Scale"],
        }),
      )
      .then((loaded) => {
        if (cancelled) return;
        const AMap = loaded as AmapNamespace;
        const first = pointsRef.current[0];
        if (!first) return;
        const created = new AMap.Map(container, {
          zoom: 15,
          center: [first.lng, first.lat],
        });
        map = created;
        let overlays: unknown[] = [];
        const draw = () => {
          if (cancelled) return;
          if (overlays.length > 0) created.remove(overlays);
          overlays = [];
          pointsRef.current.forEach((point) => {
            const marker = new AMap.Marker({
              position: [point.lng, point.lat],
              zIndex: point.selected ? 180 : 140,
              content: `<span class="lvxu-pin${point.selected ? " is-selected" : ""}" style="display:inline-flex;min-width:1.25rem;justify-content:center;background:${point.color};color:#fff;border-radius:999px;padding:2px 6px;font-size:12px">${point.badge}</span>`,
              offset: new AMap.Pixel(-10, -10),
            });
            marker.on("click", () => selectRef.current(point.id));
            created.add(marker);
            overlays.push(marker);
          });
          const fitted = [...overlays];
          for (const line of linesRef.current) {
            const path = parseAmapPath(line.polyline).map(
              ([lng, lat]) => new AMap.LngLat(lng, lat),
            );
            if (path.length < 2) continue;
            const overlay = new AMap.Polyline({
              path,
              strokeColor: line.color,
              strokeOpacity: 1,
              strokeWeight: 6,
              zIndex: 120,
              lineJoin: "round",
              lineCap: "round",
              showDir: true,
              isOutline: true,
              outlineColor: "#fffaf6",
              borderWeight: 2,
            });
            created.add(overlay);
            overlays.push(overlay);
            fitted.push(overlay);
          }
          created.setFitView(
            fitted,
            false,
            fitted.length > pointsRef.current.length
              ? routeFitPadding
              : overviewFitPadding,
          );
        };
        drawRef.current = draw;
        created.on("complete", draw);
        draw();
        requestAnimationFrame(draw);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        loadErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      drawRef.current = () => undefined;
      map?.destroy();
    };
  }, [apiKey, pointsKey]);

  useEffect(() => {
    linesRef.current = lines;
    drawRef.current();
  }, [lines, linesKey]);

  if (points.length === 0) {
    return (
      <p className="px-3 py-6 text-sm text-muted-foreground">
        核对地点后才会在地图上标出。
      </p>
    );
  }
  return (
    <div
      ref={ref}
      className="h-full min-h-56 w-full"
      data-testid="amap-canvas"
      data-map-error={loadError ? "1" : undefined}
    >
      {loadError ? (
        <p className="px-3 py-6 text-sm leading-6">{basemapUnavailableCopy}</p>
      ) : null}
    </div>
  );
}
