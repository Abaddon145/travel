import { useEffect, useRef, useState } from "react";
import {
  announceMapFrameReady,
  basemapUnavailableCopy,
  mapFrameProtocol,
  mapFrameTokenHeader,
  mapFrameVersion,
  parseMapFrameCommand,
  postToShell,
  type MapFrameFault,
  type MapFrameState,
} from "@shared/map-frame";
import { AmapCanvas } from "@/components/amap-canvas";
import { installMapFrameProxyAuth } from "@/lib/map-frame-auth";

const embedded = () => window.parent !== window;

export function MapFrameApp() {
  const parentOrigin = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [state, setState] = useState<MapFrameState | null>(null);
  const [failedToken, setFailedToken] = useState("");
  const fault = Boolean(token) && failedToken === token;
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if (!embedded()) return undefined;
    announceMapFrameReady(window.parent);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const command = parseMapFrameCommand(event.data, event.origin);
      if (!command) return;
      parentOrigin.current = event.origin;
      if (command.type === "auth") {
        installMapFrameProxyAuth(command.token);
        setToken(command.token);
        return;
      }
      setDark(command.dark);
      setState(command.state);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!token || apiKey) return undefined;
    let cancelled = false;
    void fetch("/api/map/config", {
      headers: { accept: "application/json", [mapFrameTokenHeader]: token },
      credentials: "omit",
      signal: AbortSignal.timeout(8000),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          key?: unknown;
        } | null;
        if (!response.ok || typeof body?.key !== "string" || !body.key) {
          throw new Error("map config");
        }
        return body.key;
      })
      .then((key) => {
        if (!cancelled) setApiKey(key);
      })
      .catch(() => {
        if (!cancelled) setFailedToken(token);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, token]);

  function report(reason: MapFrameFault) {
    const origin = parentOrigin.current;
    if (!origin) return;
    postToShell(window.parent, origin, {
      protocol: mapFrameProtocol,
      version: mapFrameVersion,
      type: "fault",
      reason,
    });
  }

  if (!embedded()) {
    return <p className="px-3 py-6 text-sm leading-6">这页只在旅序的行程地图里使用。</p>;
  }
  if (fault) {
    return <p className="px-3 py-6 text-sm leading-6">{basemapUnavailableCopy}</p>;
  }
  if (!apiKey || !state) {
    return <p className="px-3 py-6 text-sm">正在加载地图。</p>;
  }
  return (
    <AmapCanvas
      apiKey={apiKey}
      points={state.points.map((point) => ({
        ...point,
        selected: point.id === state.selectedId,
      }))}
      lines={state.lines}
      onSelect={(id) => {
        const origin = parentOrigin.current;
        if (!origin) return;
        postToShell(window.parent, origin, {
          protocol: mapFrameProtocol,
          version: mapFrameVersion,
          type: "select",
          id,
        });
      }}
      onLoadError={() => report("basemap")}
    />
  );
}
