import { describe, expect, it } from "vitest";
import config from "./capacitor.config";
import {
  isShellOrigin,
  legacyShellOrigin,
  shellHostname,
  shellOrigin,
  shellScheme,
  workerOrigin,
} from "./shared/shell-origin";

describe("Capacitor 壳", () => {
  it("加载包内 dist，不打开线上站点", () => {
    expect(config.webDir).toBe("dist");
    expect(config.appId).toBe("app.lvxu.travel");
    expect(config.appName).toBe("旅序");
    expect(config.server?.url).toBeUndefined();
    expect(config.server?.iosScheme).toBe(shellScheme);
    expect(config.server?.iosScheme).toBe("capacitor");
    expect(config.server?.hostname).toBe(shellHostname);
    expect(shellHostname).toBe(new URL(workerOrigin).hostname);
    expect(shellOrigin).toBe("capacitor://lvxu-ai-travel.lvxu.workers.dev");
    expect(legacyShellOrigin).toBe("capacitor://localhost");
    expect(isShellOrigin(shellOrigin)).toBe(true);
    expect(isShellOrigin(legacyShellOrigin)).toBe(true);
    expect(isShellOrigin(workerOrigin)).toBe(false);
    expect(isShellOrigin("capacitor://evil.example")).toBe(false);
    expect(config.server?.allowNavigation).toBeUndefined();
    expect(config.server?.cleartext).toBeUndefined();
  });
});
