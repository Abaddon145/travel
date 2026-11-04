export type RouteMode = "walking" | "driving" | "transit";

export type StoredRoute = {
  id: string;
  tripId: string;
  fromItemId: string;
  toItemId: string;
  mode: RouteMode;
  ok: boolean;
  distanceMeters: number | null;
  durationSeconds: number | null;
  polyline: string;
  fetchedAt: number;
  fromPoiId: string;
  toPoiId: string;
};

export type RoutePresentation = {
  status: "verified" | "unverified" | "stale" | "failed";
  label: string;
  detail: string | null;
};

const WEEK = 7 * 24 * 60 * 60 * 1000;
const modeLabel: Record<RouteMode, string> = {
  walking: "步行",
  driving: "驾车",
  transit: "公交",
};

export const routeModes: RouteMode[] = ["walking", "driving", "transit"];

export function routesForLeg(routes: StoredRoute[], fromItemId: string, toItemId: string) {
  return routes.filter((route) => route.fromItemId === fromItemId && route.toItemId === toItemId);
}

export type RoutePick = {
  id: string;
  tripId: string;
  fromItemId: string;
  toItemId: string;
  mode: RouteMode;
};

export function chosenRouteMode(picked: RouteMode | null, routes: StoredRoute[]): RouteMode | null {
  return picked ?? latestRouteMode(routes);
}

export function latestRouteMode(routes: StoredRoute[]): RouteMode | null {
  let latest: StoredRoute | null = null;
  for (const route of routes) {
    if (!latest || route.fetchedAt >= latest.fetchedAt) latest = route;
  }
  return latest?.mode ?? null;
}

export function transitHasNoTrack(route: StoredRoute | null, presentation: RoutePresentation) {
  return presentation.status === "verified" && route?.mode === "transit" && route.polyline.trim() === "";
}

export function presentRoute(
  route: StoredRoute | null,
  endpoints: { fromPoiId: string; toPoiId: string },
  now = Date.now(),
): RoutePresentation {
  if (!route) return { status: "unverified", label: "未核实", detail: null };
  if (!route.ok || route.distanceMeters === null) {
    return { status: "failed", label: "查询失败", detail: null };
  }
  const stale =
    now - route.fetchedAt > WEEK ||
    route.fromPoiId !== endpoints.fromPoiId ||
    route.toPoiId !== endpoints.toPoiId;
  if (stale) return { status: "stale", label: "已过期", detail: null };
  const minutes = route.durationSeconds === null ? null : Math.max(1, Math.round(route.durationSeconds / 60));
  const distance = `${route.distanceMeters} 米`;
  return {
    status: "verified",
    label: "已核实",
    detail: minutes === null ? `${modeLabel[route.mode]} ${distance}` : `${modeLabel[route.mode]} ${distance} · ${minutes} 分钟`,
  };
}
