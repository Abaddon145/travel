export type PlaceWeather =
  | { ok: true; temperature: number; label: string }
  | { ok: false; reason: "offline" | "unknown" | "network" };

const labels: Record<number, string> = {
  0: "晴",
  1: "大部晴朗",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "雾",
  51: "小雨",
  53: "小雨",
  55: "小雨",
  61: "雨",
  63: "雨",
  65: "大雨",
  71: "雪",
  73: "雪",
  75: "大雪",
  80: "阵雨",
  81: "阵雨",
  82: "强阵雨",
  95: "雷雨",
  96: "雷雨",
  99: "雷雨",
};

export function weatherLabel(code: number) {
  return labels[code] ?? "天气";
}

export async function readPlaceWeather(place: string): Promise<PlaceWeather> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, reason: "offline" };
  }
  const name = place.trim();
  if (!name) return { ok: false, reason: "unknown" };
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!geo.ok) return { ok: false, reason: "network" };
    const found = (await geo.json()) as {
      results?: { latitude: number; longitude: number }[];
    };
    const hit = found.results?.[0];
    if (!hit) return { ok: false, reason: "unknown" };
    const forecast = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code&timezone=auto`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!forecast.ok) return { ok: false, reason: "network" };
    const body = (await forecast.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const temperature = body.current?.temperature_2m;
    const code = body.current?.weather_code;
    if (typeof temperature !== "number" || typeof code !== "number") {
      return { ok: false, reason: "unknown" };
    }
    return { ok: true, temperature: Math.round(temperature), label: weatherLabel(code) };
  } catch {
    return { ok: false, reason: "network" };
  }
}
