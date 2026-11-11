import { afterEach, describe, expect, it, vi } from "vitest";
import { readPlaceWeather, weatherLabel } from "@/lib/weather";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("天气", () => {
  it("把天气代码说成人话", () => {
    expect(weatherLabel(0)).toBe("晴");
    expect(weatherLabel(63)).toBe("雨");
    expect(weatherLabel(999)).toBe("天气");
  });

  it("离线、找不到和成功都有结果", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(await readPlaceWeather("京都")).toEqual({ ok: false, reason: "offline" });

    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("geocoding")) {
          return Response.json({ results: [{ latitude: 35.01, longitude: 135.77 }] });
        }
        return Response.json({ current: { temperature_2m: 16.4, weather_code: 2 } });
      }),
    );
    expect(await readPlaceWeather("京都")).toEqual({ ok: true, temperature: 16, label: "多云" });

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ results: [] })));
    expect(await readPlaceWeather("不存在的地方")).toEqual({ ok: false, reason: "unknown" });
  });
});
