const washes = ["#8c4a32", "#3f6b58", "#3d5c78", "#8a5a32", "#6a4e78", "#4e6670"];

export function coverColor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return washes[hash % washes.length] ?? washes[0];
}

export const dayPalette = washes;
