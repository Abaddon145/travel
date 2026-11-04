import { useEffect, useRef } from "react";
import { overviewFitPadding, parseAmapPath, routeFitPadding, routeStroke } from "@/lib/amap-path";

type AmapMap = {
  add: (overlay: unknown) => void;
  remove: (overlay: unknown) => void;
  on: (event: string, handler: () => void) => void;
  setFitView: (overlays?: unknown[], immediately?: boolean, avoid?: number[]) => void;
  destroy: () => void;
};

type AmapNamespace = {
  Map: new (container: HTMLElement, options?: { zoom?: number; center?: [number, number] }) => AmapMap;
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

export function AmapCanvas({
  apiKey,
  points,
  polyline,
  onSelect,
}: {
  apiKey: string;
  points: { id: string; lng: number; lat: number; label: string }[];
  polyline: string;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const pointsRef = useRef(points);
  const lineRef = useRef(polyline);
  const drawRef = useRef<() => void>(() => undefined);
  const pointsKey = points.map((point) => `${point.id}:${point.lng}:${point.lat}:${point.label}`).join("|");

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    const container = ref.current;
    if (!container || pointsRef.current.length === 0) return undefined;
    let cancelled = false;
    let map: AmapMap | null = null;

    window._AMapSecurityConfig = { serviceHost: `${window.location.origin}/_AMapService` };
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
          pointsRef.current.forEach((point, index) => {
            const marker = new AMap.Marker({
              position: [point.lng, point.lat],
              zIndex: 140,
              content: `<span style="background:${routeStroke};color:#fff;border-radius:999px;padding:2px 6px;font-size:12px">${index + 1}</span>`,
              offset: new AMap.Pixel(-10, -10),
            });
            marker.on("click", () => selectRef.current(point.id));
            created.add(marker);
            overlays.push(marker);
          });
          const markers = [...overlays];
          const path = parseAmapPath(lineRef.current).map(([lng, lat]) => new AMap.LngLat(lng, lat));
          if (path.length > 1) {
            const line = new AMap.Polyline({
              path,
              strokeColor: routeStroke,
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
            created.add(line);
            overlays.push(line);
            created.setFitView([line], false, routeFitPadding);
            return;
          }
          created.setFitView(markers, false, overviewFitPadding);
        };
        drawRef.current = draw;
        created.on("complete", draw);
        draw();
      })
      .catch(() => {
        container.dataset.mapError = "1";
      });

    return () => {
      cancelled = true;
      drawRef.current = () => undefined;
      map?.destroy();
    };
  }, [apiKey, pointsKey]);

  useEffect(() => {
    lineRef.current = polyline;
    drawRef.current();
  }, [polyline]);

  if (points.length === 0) {
    return <p className="px-3 py-6 text-sm text-muted-foreground">核对地点后才会在地图上标出。</p>;
  }
  return <div ref={ref} className="h-56 w-full" data-testid="amap-canvas" />;
}
