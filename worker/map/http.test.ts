// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { handleMapRequest } from "./http";

function upstream(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("路线请求", () => {
  it("公交走 v3 并要求分段轨迹", async () => {
    const seen: URL[] = [];
    const response = await handleMapRequest(
      new Request(
        "https://lvxu.test/api/map/route?mode=transit&origin=120.140000,30.250000&destination=120.160000,30.260000&city=0571",
      ),
      { AMAP_WEB_KEY: "web-key" },
      vi.fn(async (input: RequestInfo | URL) => {
        seen.push(new URL(String(input)));
        return upstream({
          status: "1",
          infocode: "10000",
          route: {
            transits: [
              {
                distance: "3327",
                duration: "2159",
                segments: [
                  {
                    walking: { steps: [{ polyline: "120.14,30.25;120.15,30.25" }] },
                    bus: { buslines: [{ polyline: "120.15,30.25;120.16,30.26" }] },
                  },
                ],
              },
            ],
          },
        });
      }) as unknown as typeof fetch,
    );
    expect(seen[0]?.pathname).toBe("/v3/direction/transit/integrated");
    expect(seen[0]?.searchParams.get("extensions")).toBe("all");
    expect(seen[0]?.searchParams.get("city")).toBe("0571");
    expect(seen[0]?.searchParams.has("show_fields")).toBe(false);
    const body = (await response.json()) as { route: { polyline: string; durationSeconds: number } };
    expect(body.route.durationSeconds).toBe(2159);
    expect(body.route.polyline).toBe("120.14,30.25;120.15,30.25;120.15,30.25;120.16,30.26");
  });

  it("步行仍走 v5，并请求折线", async () => {
    const seen: URL[] = [];
    await handleMapRequest(
      new Request(
        "https://lvxu.test/api/map/route?mode=walking&origin=120.140000,30.250000&destination=120.160000,30.260000",
      ),
      { AMAP_WEB_KEY: "web-key" },
      vi.fn(async (input: RequestInfo | URL) => {
        seen.push(new URL(String(input)));
        return upstream({
          status: "1",
          infocode: "10000",
          route: { paths: [{ distance: "860", cost: { duration: "720" }, steps: [{ polyline: "120.14,30.25;120.16,30.26" }] }] },
        });
      }) as unknown as typeof fetch,
    );
    expect(seen[0]?.pathname).toBe("/v5/direction/walking");
    expect(seen[0]?.searchParams.get("show_fields")).toBe("cost,polyline");
  });
});
