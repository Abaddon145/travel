import { describe, expect, it } from "vitest";
import { dragReorder, swipeDelete } from "@/lib/gestures";

describe("手势阈值", () => {
  it("明显左滑才算删除，上下拖动不算", () => {
    expect(swipeDelete(-80, 10)).toBe(true);
    expect(swipeDelete(-40, 0)).toBe(false);
    expect(swipeDelete(-80, 90)).toBe(false);
  });

  it("纵向超过一截才排序", () => {
    expect(dragReorder(-40)).toBe("up");
    expect(dragReorder(40)).toBe("down");
    expect(dragReorder(10)).toBeNull();
  });
});
