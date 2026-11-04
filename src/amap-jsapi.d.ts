declare module "@amap/amap-jsapi-loader" {
  const AMapLoader: {
    load(options: { key: string; version: string; plugins?: string[] }): Promise<{
      Map: new (container: HTMLElement, options?: { zoom?: number; center?: [number, number] }) => {
        add: (overlay: unknown) => void;
        setFitView: () => void;
        destroy: () => void;
      };
      Marker: new (options: {
        position: [number, number];
        content?: string;
        offset?: unknown;
      }) => { on: (event: string, handler: () => void) => void };
      Polyline: new (options: { path: [number, number][]; strokeColor?: string; strokeWeight?: number }) => unknown;
      Pixel: new (x: number, y: number) => unknown;
    }>;
  };
  export default AMapLoader;
}

interface Window {
  _AMapSecurityConfig?: { serviceHost: string };
}
