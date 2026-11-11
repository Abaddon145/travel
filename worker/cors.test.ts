// @vitest-environment node
import { describe, expect, it } from "vitest";
import { shellOrigin } from "../shared/shell-origin";
import { shellPreflight, withShellCors } from "./cors";

describe("壳的跨源", () => {
  it("只回显壳源，不使用通配", () => {
    const request = new Request("https://lvxu.test/api/status", {
      method: "OPTIONS",
      headers: { origin: shellOrigin },
    });
    const preflight = shellPreflight(request);
    expect(preflight?.status).toBe(204);
    expect(preflight?.headers.get("access-control-allow-origin")).toBe(shellOrigin);
    expect(preflight?.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(preflight?.headers.get("access-control-allow-credentials")).toBe("true");
    expect(preflight?.headers.get("access-control-allow-headers")).toContain(
      "authorization",
    );

    const foreign = shellPreflight(
      new Request("https://lvxu.test/api/status", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      }),
    );
    expect(foreign).toBeNull();

    const same = new Response("{}", { status: 200 });
    expect(withShellCors(new Request("https://lvxu.test/api/status"), same)).toBe(same);
    const opened = withShellCors(request, new Response("{}", { status: 200 }));
    expect(opened.headers.get("access-control-allow-origin")).toBe(shellOrigin);
    expect(opened.headers.get("access-control-allow-credentials")).toBe("true");
  });
});
