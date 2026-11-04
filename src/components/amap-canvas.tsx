import { useEffect, useRef } from "react";

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

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = ref.current;
    if (!container || points.length === 0) return undefined;
    let map: { destroy: () => void } | null = null;
    let cancelled = false;
    window._AMapSecurityConfig = { serviceHost: `${window.location.origin}/_AMapService` };
    void import("@amap/amap-jsapi-loader")
      .then((module) =>
        module.default.load({
          key: apiKey,
          version: "2.0",
          plugins: ["AMap.Scale"],
        }),
      )
      .then((AMap) => {
        if (cancelled) return;
        const first = points[0];
        if (!first) return;
        const created = new AMap.Map(container, {
          zoom: 13,
          center: [first.lng, first.lat],
        });
        map = created;
        points.forEach((point, index) => {
          const marker = new AMap.Marker({
            position: [point.lng, point.lat],
            content: `<span style="background:#8c4a32;color:#fff;border-radius:999px;padding:2px 6px;font-size:12px">${index + 1}</span>`,
            offset: new AMap.Pixel(-10, -10),
          });
          marker.on("click", () => selectRef.current(point.id));
          created.add(marker);
        });
        const path = polyline
          .split(";")
          .map((pair) => pair.split(",").map(Number))
          .filter((pair) => pair.length === 2 && pair.every(Number.isFinite)) as [number, number][];
        if (path.length > 1) {
          created.add(new AMap.Polyline({ path, strokeColor: "#8c4a32", strokeWeight: 4 }));
        }
        if (points.length > 0) created.setFitView();
      })
      .catch(() => {
        container.dataset.mapError = "1";
      });
    return () => {
      cancelled = true;
      map?.destroy();
    };
  }, [apiKey, points, polyline]);

  if (points.length === 0) {
    return <p className="px-3 py-6 text-sm text-muted-foreground">核对地点后才会在地图上标出。</p>;
  }
  return <div ref={ref} className="h-56 w-full" data-testid="amap-canvas" />;
}
