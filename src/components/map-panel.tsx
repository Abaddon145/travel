import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AmapCanvas } from "@/components/amap-canvas";
import { Button } from "@/components/ui/button";
import { attachMapMatch, readMapRoutes, saveMapRoute } from "@/db/repository";
import { db } from "@/db/database";
import type { TimelineEntry } from "@/domain/types";
import { fetchMapRoute, geocodeCity, loadMapConfig, searchPlaces, type PoiCandidate } from "@/lib/map-client";
import { presentRoute, type RouteMode } from "@/lib/route-status";

export type MapPhase = "closed" | "offline" | "not_configured" | "unauthorized" | "loading" | "ready" | "error";

export function MapPanel({
  tripId,
  destination,
  items,
  selectedId,
  onSelect,
}: {
  tripId: string;
  destination: string;
  items: TimelineEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<MapPhase>("closed");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [candidates, setCandidates] = useState<PoiCandidate[]>([]);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const routes = useLiveQuery(() => readMapRoutes(db, tripId), [tripId]) ?? [];

  async function openMap() {
    setOpen(true);
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    setPhase("loading");
    const config = await loadMapConfig();
    if (!config.ok) {
      setPhase(config.error === "unauthorized" ? "unauthorized" : config.error === "not_configured" ? "not_configured" : "error");
      return;
    }
    setApiKey(config.config.key);
    setPhase("ready");
  }

  async function match(item: TimelineEntry) {
    setMatchingId(item.id);
    setMessage("");
    const result = await searchPlaces(item.name, destination).catch(() => null);
    if (!result?.ok) {
      setMessage(result?.message ?? "没有连上高德。");
      setCandidates([]);
      return;
    }
    setCandidates(result.pois);
    if (result.pois.length === 0) setMessage("高德没有找到同名地点。");
  }

  async function confirm(item: TimelineEntry, poi: PoiCandidate) {
    await attachMapMatch(db, item.kind, item.refId, {
      poiId: poi.id,
      name: poi.name,
      address: poi.address,
      lng: poi.lng,
      lat: poi.lat,
    });
    setCandidates([]);
    setMatchingId(null);
  }

  async function verify(from: TimelineEntry, to: TimelineEntry, mode: RouteMode) {
    if (from.amapLng == null || from.amapLat == null || to.amapLng == null || to.amapLat == null) {
      setMessage("先核对两端地点，才能查询路线。");
      return;
    }
    const city = mode === "transit" ? await geocodeCity(destination).catch(() => "") : "";
    if (mode === "transit" && !city) {
      setMessage("高德没有返回城市编码，公交路线未核实。");
      return;
    }
    const result = await fetchMapRoute({
      mode,
      origin: `${from.amapLng},${from.amapLat}`,
      destination: `${to.amapLng},${to.amapLat}`,
      city,
    }).catch(() => null);
    await saveMapRoute(db, {
      id: `${from.id}:${to.id}:${mode}`,
      tripId,
      fromItemId: from.id,
      toItemId: to.id,
      mode,
      ok: Boolean(result?.ok),
      distanceMeters: result?.ok ? result.route.distanceMeters : null,
      durationSeconds: result?.ok ? result.route.durationSeconds : null,
      polyline: result?.ok ? result.route.polyline : "",
      fetchedAt: result?.ok ? result.fetchedAt : 0,
      fromPoiId: from.amapPoiId ?? "",
      toPoiId: to.amapPoiId ?? "",
    });
    if (!result?.ok) setMessage(result?.message ?? "没有连上高德。");
  }

  const points = items.flatMap((item) =>
    item.amapLng == null || item.amapLat == null
      ? []
      : [{ id: item.id, lng: item.amapLng, lat: item.amapLat, label: item.name }],
  );
  const selectedRoute = routes.find((route) => route.fromItemId === selectedId);
  const shown = presentRoute(
    selectedRoute ?? null,
    { fromPoiId: selectedRoute?.fromPoiId ?? "", toPoiId: selectedRoute?.toPoiId ?? "" },
  );

  return (
    <motion.section
      className="flex flex-col gap-3"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">地图</h2>
        <Button type="button" variant="outline" className="h-11" onClick={() => (open ? setOpen(false) : void openMap())}>
          {open ? "收起地图" : "展开地图"}
        </Button>
      </div>
      {open ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          {phase === "offline" ? <p className="px-3 py-6 text-sm">地图需要网络。时间线仍可使用。</p> : null}
          {phase === "not_configured" ? <p className="px-3 py-6 text-sm">高德密钥还没配置。</p> : null}
          {phase === "unauthorized" ? <p className="px-3 py-6 text-sm">请先在「我的」里验证私人密钥。</p> : null}
          {phase === "loading" ? <p className="px-3 py-6 text-sm">正在加载地图。</p> : null}
          {phase === "error" ? <p className="px-3 py-6 text-sm">地图暂时无法加载。</p> : null}
          {phase === "ready" ? (
            <AmapCanvas
              apiKey={apiKey}
              points={points}
              polyline={shown.status === "verified" ? (selectedRoute?.polyline ?? "") : ""}
              onSelect={onSelect}
            />
          ) : null}
        </div>
      ) : null}
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => {
          const next = items[index + 1];
          const pair = next
            ? routes.find((route) => route.fromItemId === item.id && route.toItemId === next.id) ?? null
            : null;
          const presentation = next
            ? presentRoute(pair, { fromPoiId: item.amapPoiId ?? "", toPoiId: next.amapPoiId ?? "" })
            : null;
          return (
            <li key={item.id} className="flex flex-col gap-2">
              <button
                type="button"
                className="text-left text-sm"
                aria-current={selectedId === item.id}
                onClick={() => onSelect(item.id)}
              >
                {index + 1}. {item.name}
                {item.mapSource === "amap" ? " · 已核对" : " · 未核实"}
              </button>
              {matchingId === item.id ? (
                <div className="flex flex-col gap-2">
                  {candidates.map((poi) => (
                    <Button key={poi.id} type="button" variant="outline" className="h-11 justify-start" onClick={() => void confirm(item, poi)}>
                      {poi.name}
                      {poi.address ? ` · ${poi.address}` : ""}
                      {poi.distanceMeters === undefined ? "" : ` · 距检索中心 ${poi.distanceMeters} 米`}
                    </Button>
                  ))}
                </div>
              ) : (
                <Button type="button" variant="ghost" className="h-11 w-fit" onClick={() => void match(item)}>
                  核对地点
                </Button>
              )}
              {presentation && next ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    {presentation.label}
                    {presentation.detail ? ` · ${presentation.detail}` : ""}
                  </p>
                  <Button type="button" variant="outline" className="h-11" onClick={() => void verify(item, next, "walking")}>
                    核实步行
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={() => void verify(item, next, "driving")}>
                    核实驾车
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={() => void verify(item, next, "transit")}>
                    核实公交
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </motion.section>
  );
}
