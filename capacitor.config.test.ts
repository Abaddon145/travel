import { describe, expect, it } from "vitest";
import config from "./capacitor.config";
import { shellHostname, shellOrigin, shellScheme } from "./shared/shell-origin";

describe("Capacitor 壳", () => {
  it("加载包内 dist，不打开线上站点", () => {
    expect(config.webDir).toBe("dist");
    expect(config.appId).toBe("app.lvxu.travel");
    expect(config.appName).toBe("旅序");
    expect(config.server?.url).toBeUndefined();
    expect(config.server?.iosScheme).toBe(shellScheme);
    expect(config.server?.hostname).toBe(shellHostname);
    expect(shellOrigin).toBe("capacitor://localhost");
    expect(config.server?.allowNavigation).toBeUndefined();
    expect(config.server?.cleartext).toBeUndefined();
  });
});
