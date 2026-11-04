declare module "@amap/amap-jsapi-loader" {
  const AMapLoader: {
    load(options: { key: string; version: string; plugins?: string[] }): Promise<{
      Map: new (container: HTMLElement, options?: { zoom?: number; center?: [number, number] }) => {
        add: (overlay: unknown) => void;
        remove: (overlay: unknown) => void;
        on: (event: string, handler: () => void) => void;
        setFitView: (overlays?: unknown[], immediately?: boolean, avoid?: number[]) => void;
        destroy: () => void;
      };
      Marker: new (options: {
        position: [number, number];
        content?: string;
        offset?: unknown;
        zIndex?: number;
      }) => { on: (event: string, handler: () => void) => void };
      LngLat: new (lng: number, lat: number) => { lng: number; lat: number };
      Polyline: new (options: {
        path: unknown[];
        strokeColor?: string;
        strokeWeight?: number;
        strokeOpacity?: number;
        zIndex?: number;
        lineJoin?: string;
        lineCap?: string;
        showDir?: boolean;
        isOutline?: boolean;
        outlineColor?: string;
        borderWeight?: number;
      }) => unknown;
      Pixel: new (x: number, y: number) => unknown;
    }>;
  };
  export default AMapLoader;
}

interface Window {
  _AMapSecurityConfig?: { serviceHost: string };
}
