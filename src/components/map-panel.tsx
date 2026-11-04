import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AmapCanvas } from "@/components/amap-canvas";
import { Button } from "@/components/ui/button";
import { attachMapMatch, readMapRoutes, readRoutePicks, saveMapRoute, saveRoutePick } from "@/db/repository";
import { db } from "@/db/database";
import type { TimelineEntry } from "@/domain/types";
import { fetchMapRoute, geocodeCity, loadMapConfig, searchPlaces, type PoiCandidate } from "@/lib/map-client";
import {
  chosenRouteMode,
  presentRoute,
  routeModes,
  routesForLeg,
  transitHasNoTrack,
  type RouteMode,
  type StoredRoute,
} from "@/lib/route-status";
import { cn } from "cn";

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
  const picks = useLiveQuery(() => readRoutePicks(db, tripId), [tripId]) ?? [];

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

  function pickedMode(fromId: string, toId: string): RouteMode | null {
    return picks.find((pick) => pick.fromItemId === fromId && pick.toItemId === toId)?.mode ?? null;
  }

  function choose(fromId: string, toId: string, mode: RouteMode) {
    return saveRoutePick(db, {
      id: `${fromId}:${toId}`,
      tripId,
      fromItemId: fromId,
      toItemId: toId,
      mode,
    });
  }

  async function verify(from: TimelineEntry, to: TimelineEntry, mode: RouteMode) {
    await choose(from.id, to.id, mode);
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
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : undefined;
  const selectedNext = selectedIndex >= 0 ? items[selectedIndex + 1] : undefined;
  const selectedLeg =
    selectedItem && selectedNext ? routesForLeg(routes, selectedItem.id, selectedNext.id) : [];
  const selectedMode =
    selectedItem && selectedNext
      ? chosenRouteMode(pickedMode(selectedItem.id, selectedNext.id), selectedLeg)
      : null;
  const selectedRoute = selectedMode
    ? (selectedLeg.find((route) => route.mode === selectedMode) ?? null)
    : null;
  const selectedPresentation = presentRoute(selectedRoute, {
    fromPoiId: selectedItem?.amapPoiId ?? "",
    toPoiId: selectedNext?.amapPoiId ?? "",
  });
  const selectedLine = selectedPresentation.status === "verified" ? (selectedRoute?.polyline ?? "") : "";
  const selectedMissingTrack = transitHasNoTrack(selectedRoute, selectedPresentation);

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
            <>
              <AmapCanvas apiKey={apiKey} points={points} polyline={selectedLine} onSelect={onSelect} />
              {selectedMissingTrack ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">公交线路无轨迹</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      <ul className="flex flex-col gap-3">
        {items.map((item, index) => {
          const next = items[index + 1];
          const leg = next ? routesForLeg(routes, item.id, next.id) : [];
          const active = next ? chosenRouteMode(pickedMode(item.id, next.id), leg) : null;
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
              {next ? (
                <LegModes
                  from={item}
                  to={next}
                  routes={leg}
                  active={active}
                  onSelect={(mode) => {
                    onSelect(item.id);
                    return choose(item.id, next.id, mode);
                  }}
                  onVerify={(mode) => {
                    onSelect(item.id);
                    return verify(item, next, mode);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </motion.section>
  );
}

const verifyLabel: Record<RouteMode, string> = {
  walking: "核实步行",
  driving: "核实驾车",
  transit: "核实公交",
};

function LegModes({
  from,
  to,
  routes,
  active,
  onSelect,
  onVerify,
}: {
  from: TimelineEntry;
  to: TimelineEntry;
  routes: StoredRoute[];
  active: RouteMode | null;
  onSelect: (mode: RouteMode) => void | Promise<void>;
  onVerify: (mode: RouteMode) => void | Promise<void>;
}) {
  const endpoints = { fromPoiId: from.amapPoiId ?? "", toPoiId: to.amapPoiId ?? "" };
  const stored = routeModes.flatMap((mode) => {
    const route = routes.find((item) => item.mode === mode);
    return route ? [{ mode, route }] : [];
  });

  return (
    <div className="flex flex-col gap-2">
      {stored.length === 0 ? (
        <p className="text-sm text-muted-foreground">未核实</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {stored.map(({ mode, route }) => {
            const presentation = presentRoute(route, endpoints);
            const missing = transitHasNoTrack(route, presentation);
            return (
              <li key={mode}>
                <button
                  type="button"
                  aria-pressed={active === mode}
                  className={cn(
                    "flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-pretty",
                    active === mode ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground",
                  )}
                  onClick={() => void onSelect(mode)}
                >
                  {presentation.detail ?? presentation.label}
                  {missing ? " · 公交线路无轨迹" : ""}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div role="group" aria-label="核实路线" className="grid grid-cols-3 overflow-hidden rounded-lg border">
        {routeModes.map((mode) => (
          <Button
            key={mode}
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-none px-1"
            onClick={() => void onVerify(mode)}
          >
            {verifyLabel[mode]}
          </Button>
        ))}
      </div>
    </div>
  );
}
