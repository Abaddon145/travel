import { lazy, Suspense, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, useReducedMotion } from "motion/react";
import type { MapLine, MapPoint } from "@/components/amap-canvas";
import { MapFrameHost } from "@/components/map-frame-host";
import { OwnerKeyForm } from "@/components/owner-key-form";
import { Button } from "@/components/ui/button";
import {
  attachMapMatch,
  readMapRoutes,
  readRoutePicks,
  saveMapRoute,
  saveRoutePick,
} from "@/db/repository";
import { db } from "@/db/database";
import type { DayView, TimelineEntry } from "@/domain/types";
import { dayPalette } from "@/lib/cover-color";
import { formatDateWithWeekday } from "@/lib/dates";
import { isNativeShell } from "@/lib/api-origin";
import {
  fetchMapRoute,
  geocodeCity,
  loadMapConfig,
  searchPlaces,
  type PoiCandidate,
} from "@/lib/map-client";
import { useOnline } from "@/lib/online";
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

const AmapCanvas = lazy(() =>
  import("@/components/amap-canvas").then((module) => ({ default: module.AmapCanvas })),
);

export type MapPhase =
  | "closed"
  | "offline"
  | "not_configured"
  | "unauthorized"
  | "loading"
  | "ready"
  | "error";

type MapDay = Pick<DayView, "id" | "title" | "date" | "items">;

function storageKey(tripId: string) {
  return `lvxu-map-open:${tripId}`;
}

export function MapPanel({
  tripId,
  destination,
  days,
  selectedId,
  onSelect,
}: {
  tripId: string;
  destination: string;
  days: MapDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const online = useOnline();
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey(tripId)) === "1";
    } catch {
      return false;
    }
  });
  const [phase, setPhase] = useState<MapPhase>("closed");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [candidates, setCandidates] = useState<PoiCandidate[]>([]);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const routes = useLiveQuery(() => readMapRoutes(db, tripId), [tripId]) ?? [];
  const picks = useLiveQuery(() => readRoutePicks(db, tripId), [tripId]) ?? [];
  const items = days.flatMap((day) => day.items);
  const verified = items.filter((item) => item.mapSource === "amap").length;

  const visiblePhase: MapPhase =
    !online && open && phase !== "closed" ? "offline" : phase;

  async function openMap() {
    setOpen(true);
    try {
      sessionStorage.setItem(storageKey(tripId), "1");
    } catch {
      // The map can still open for this visit.
    }
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    setPhase("loading");
    const config = await loadMapConfig();
    if (!config.ok) {
      setPhase(
        config.error === "unauthorized"
          ? "unauthorized"
          : config.error === "not_configured"
            ? "not_configured"
            : "error",
      );
      return;
    }
    setApiKey(config.config.key);
    setPhase("ready");
  }

  function closeMap() {
    setOpen(false);
    setPhase("closed");
    try {
      sessionStorage.removeItem(storageKey(tripId));
    } catch {
      // Closing still hides the map.
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => {
      void openMap();
    }, 0);
    return () => window.clearTimeout(timer);
    // Resume a remembered map once, after the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function match(item: TimelineEntry) {
    if (!navigator.onLine) {
      setMessage("核对地点需要网络。时间线上已保存的地点仍可查看。");
      return;
    }
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
    return (
      picks.find((pick) => pick.fromItemId === fromId && pick.toItemId === toId)?.mode ??
      null
    );
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
    if (!navigator.onLine) {
      setMessage("核实路线需要网络。已保存的结果仍会显示，离线时不估算距离。");
      return;
    }
    await choose(from.id, to.id, mode);
    if (
      from.amapLng == null ||
      from.amapLat == null ||
      to.amapLng == null ||
      to.amapLat == null
    ) {
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

  const selectedDay = days.find((day) =>
    day.items.some((item) => item.id === selectedId),
  );
  const selectedIndex =
    selectedDay?.items.findIndex((item) => item.id === selectedId) ?? -1;
  const selectedItem = selectedIndex >= 0 ? selectedDay?.items[selectedIndex] : undefined;
  const selectedNext =
    selectedDay && selectedIndex >= 0 ? selectedDay.items[selectedIndex + 1] : undefined;
  const selectedLeg =
    selectedItem && selectedNext
      ? routesForLeg(routes, selectedItem.id, selectedNext.id)
      : [];
  const selectedMode =
    selectedItem && selectedNext
      ? chosenRouteMode(pickedMode(selectedItem.id, selectedNext.id), selectedLeg)
      : null;
  const selectedRoute = selectedMode
    ? (selectedLeg.find((route) => route.mode === selectedMode) ?? null)
    : null;
  const selectedMissing = transitHasNoTrack(
    selectedRoute,
    presentRoute(selectedRoute, {
      fromPoiId: selectedItem?.amapPoiId ?? "",
      toPoiId: selectedNext?.amapPoiId ?? "",
    }),
  );

  const points: MapPoint[] = days.flatMap((day, dayIndex) =>
    day.items.flatMap((item, index) =>
      item.amapLng == null || item.amapLat == null
        ? []
        : [
            {
              id: item.id,
              lng: item.amapLng,
              lat: item.amapLat,
              label: item.name,
              color: dayPalette[dayIndex % dayPalette.length] ?? "#8c4a32",
              badge: String(index + 1),
              selected: item.id === selectedId,
            },
          ],
    ),
  );
  const lines = mapLines(
    days,
    routes,
    (fromId, toId) => pickedMode(fromId, toId),
    selectedId,
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
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => (open ? closeMap() : void openMap())}
        >
          {open ? "收起地图" : "展开地图"}
        </Button>
      </div>
      <p data-testid="map-summary" className="text-sm text-muted-foreground">
        {items.length} 个地点 · {verified} 已核对
      </p>
      {open ? (
        <div className="sticky top-[var(--page-header-height,0px)] z-10 -mx-4 border-y bg-background px-4 py-3">
          <div className="h-[min(20rem,46dvh)] overflow-hidden rounded-lg border bg-card">
            {visiblePhase === "offline" ? (
              <p className="px-3 py-6 text-sm leading-6">
                地图需要网络。时间线上已保存的地点仍可查看，离线时不估算距离。
              </p>
            ) : null}
            {visiblePhase === "not_configured" ? (
              <p className="px-3 py-6 text-sm">高德密钥还没配置。</p>
            ) : null}
            {visiblePhase === "unauthorized" ? (
              <div className="flex flex-col gap-3 px-3 py-4">
                <p className="text-sm">请先验证私人密钥，再打开地图。</p>
                <OwnerKeyForm onVerified={() => void openMap()} />
              </div>
            ) : null}
            {visiblePhase === "loading" ? (
              <p className="px-3 py-6 text-sm">正在加载地图。</p>
            ) : null}
            {visiblePhase === "error" ? (
              <p className="px-3 py-6 text-sm">地图暂时无法加载。</p>
            ) : null}
            {visiblePhase === "ready" ? (
              <Suspense fallback={<p className="px-3 py-6 text-sm">正在加载地图。</p>}>
                {isNativeShell() ? (
                  <MapFrameHost
                    points={points}
                    lines={lines}
                    selectedId={selectedId}
                    onSelect={onSelect}
                  />
                ) : (
                  <AmapCanvas
                    apiKey={apiKey}
                    points={points}
                    lines={lines}
                    onSelect={onSelect}
                  />
                )}
                {selectedMissing ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    公交线路无轨迹
                  </p>
                ) : null}
              </Suspense>
            ) : null}
          </div>
        </div>
      ) : null}
      {open ? (
        <div className="flex flex-col gap-6">
          {days.map((day, dayIndex) => (
            <section key={day.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ background: dayPalette[dayIndex % dayPalette.length] }}
                />
                <h3 className="text-sm font-medium">{day.title}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDateWithWeekday(day.date)}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {day.items.map((item, index) => {
                  const next = day.items[index + 1];
                  const leg = next ? routesForLeg(routes, item.id, next.id) : [];
                  const active = next
                    ? chosenRouteMode(pickedMode(item.id, next.id), leg)
                    : null;
                  const selected = selectedId === item.id;
                  return (
                    <li key={item.id} className="flex flex-col gap-2">
                      <button
                        type="button"
                        className={cn(
                          "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm",
                          selected ? "bg-primary/10 font-medium" : "bg-card",
                        )}
                        aria-current={selected ? "true" : undefined}
                        onClick={() => onSelect(item.id)}
                      >
                        {index + 1}. {item.name}
                        {item.mapSource === "amap" ? " · 已核对" : " · 未核实"}
                      </button>
                      {selected && matchingId === item.id ? (
                        <div className="flex flex-col gap-2">
                          {candidates.map((poi) => (
                            <Button
                              key={poi.id}
                              type="button"
                              variant="outline"
                              className="h-11 justify-start"
                              onClick={() => void confirm(item, poi)}
                            >
                              {poi.name}
                              {poi.address ? ` · ${poi.address}` : ""}
                              {poi.distanceMeters === undefined
                                ? ""
                                : ` · 距检索中心 ${poi.distanceMeters} 米`}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                      {selected ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-11 w-fit"
                          disabled={!online}
                          onClick={() => void match(item)}
                        >
                          {online ? "核对地点" : "核对需要网络"}
                        </Button>
                      ) : null}
                      {selected && next ? (
                        <LegModes
                          from={item}
                          to={next}
                          routes={leg}
                          active={active}
                          onSelect={(mode) => {
                            onSelect(item.id);
                            return choose(item.id, next.id, mode);
                          }}
                          online={online}
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
            </section>
          ))}
          {selectedId ? null : (
            <p className="text-sm text-muted-foreground">
              点一个地点，再核对或核实当天的路线。
            </p>
          )}
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </motion.section>
  );
}

function mapLines(
  days: MapDay[],
  routes: StoredRoute[],
  picked: (fromId: string, toId: string) => RouteMode | null,
  selectedId: string | null,
): MapLine[] {
  const lines: MapLine[] = [];
  days.forEach((day, dayIndex) => {
    day.items.forEach((item, index) => {
      const next = day.items[index + 1];
      if (!next) return;
      if (selectedId && selectedId !== item.id) return;
      const leg = routesForLeg(routes, item.id, next.id);
      const mode = chosenRouteMode(picked(item.id, next.id), leg);
      const route = mode ? (leg.find((entry) => entry.mode === mode) ?? null) : null;
      const presentation = presentRoute(route, {
        fromPoiId: item.amapPoiId ?? "",
        toPoiId: next.amapPoiId ?? "",
      });
      if (!mode || presentation.status !== "verified" || !route?.polyline.trim()) return;
      lines.push({
        id: route.id,
        polyline: route.polyline,
        color: dayPalette[dayIndex % dayPalette.length] ?? "#8c4a32",
        mode,
      });
    });
  });
  return lines;
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
  online,
  onSelect,
  onVerify,
}: {
  from: TimelineEntry;
  to: TimelineEntry;
  routes: StoredRoute[];
  active: RouteMode | null;
  online: boolean;
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
                    active === mode
                      ? "bg-primary/10 font-medium text-foreground"
                      : "text-muted-foreground",
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
      <div
        role="group"
        aria-label="核实路线"
        className="grid grid-cols-3 overflow-hidden rounded-lg border"
      >
        {routeModes.map((mode) => (
          <Button
            key={mode}
            type="button"
            variant="ghost"
            className="h-11 w-full rounded-none px-1"
            disabled={!online}
            onClick={() => void onVerify(mode)}
          >
            {verifyLabel[mode]}
          </Button>
        ))}
      </div>
    </div>
  );
}
