// @vitest-environment node
import { describe, expect, it } from "vitest";
import { legacyShellOrigin, shellOrigin, workerOrigin } from "../shared/shell-origin";
import { shellPreflight, withShellCors } from "./cors";

describe("壳的跨源", () => {
  it("回显当前壳源和旧壳源，不使用通配", () => {
    for (const origin of [shellOrigin, legacyShellOrigin]) {
      const request = new Request("https://lvxu.test/api/status", {
        method: "OPTIONS",
        headers: { origin },
      });
      const preflight = shellPreflight(request);
      expect(preflight?.status).toBe(204);
      expect(preflight?.headers.get("access-control-allow-origin")).toBe(origin);
      expect(preflight?.headers.get("access-control-allow-origin")).not.toBe("*");
      expect(preflight?.headers.get("access-control-allow-credentials")).toBe("true");
      expect(preflight?.headers.get("access-control-allow-headers")).toContain(
        "authorization",
      );
      const opened = withShellCors(request, new Response("{}", { status: 200 }));
      expect(opened.headers.get("access-control-allow-origin")).toBe(origin);
      expect(opened.headers.get("access-control-allow-credentials")).toBe("true");
    }

    const foreign = shellPreflight(
      new Request("https://lvxu.test/api/status", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(foreign).toBeNull();

    const website = shellPreflight(
      new Request("https://lvxu.test/api/status", {
        method: "OPTIONS",
        headers: { origin: workerOrigin },
      }),
    );
    expect(website).toBeNull();

    const same = new Response("{}", { status: 200 });
    expect(withShellCors(new Request("https://lvxu.test/api/status"), same)).toBe(same);
  });
});
