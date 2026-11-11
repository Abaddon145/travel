import { Capacitor } from "@capacitor/core";
import { workerOrigin } from "@shared/shell-origin";

export function isNativeShell() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function resolveApiPath(path: string) {
  if (!isNativeShell() || /^https?:\/\//i.test(path)) return path;
  return `${workerOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function amapServiceHost() {
  if (isNativeShell()) return `${workerOrigin}/_AMapService`;
  return `${window.location.origin}/_AMapService`;
}
