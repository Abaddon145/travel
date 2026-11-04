export const routeStroke = "#8c4a32";

export function parseAmapPath(polyline: string): Array<[number, number]> {
  const path: Array<[number, number]> = [];
  for (const pair of polyline.split(";")) {
    const [lngText, latText] = pair.split(",");
    const lng = Number(lngText);
    const lat = Number(latText);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) continue;
    const last = path.at(-1);
    if (last && last[0] === lng && last[1] === lat) continue;
    path.push([lng, lat]);
  }
  return path;
}
