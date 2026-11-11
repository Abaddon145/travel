export function swipeDelete(dx: number, dy: number) {
  return dx <= -72 && Math.abs(dx) > Math.abs(dy) * 1.2;
}

export function dragReorder(dy: number): "up" | "down" | null {
  if (dy <= -36) return "up";
  if (dy >= 36) return "down";
  return null;
}
