import { describe, expect, it } from "vitest";
import { splitLockedOps, type PatchOp } from "@shared/revise-schema";

const days = [
  { id: "d1", locked: false, lockedFrom: "09:00", lockedTo: "11:00" },
  { id: "d2", locked: true, lockedFrom: "", lockedTo: "" },
];
const items = [
  { id: "locked", dayId: "d1", timeLabel: "15:00", locked: true },
  { id: "window", dayId: "d1", timeLabel: "10:00", locked: false },
  { id: "open", dayId: "d1", timeLabel: "17:30", locked: false },
];

describe("锁定补丁", () => {
  it("剔除锁定项目、锁定时段和锁定全天", () => {
    const ops: PatchOp[] = [
      { op: "remove", itemId: "locked" },
      { op: "update", itemId: "window", note: "不行" },
      { op: "update", itemId: "open", note: "雨天改去室内" },
      { op: "add", dayId: "d2", kind: "place", name: "新点", area: "", note: "", timeLabel: "", order: 0 },
      { op: "add", dayId: "d1", kind: "place", name: "上午", area: "", note: "", timeLabel: "09:30", order: 1 },
    ];
    const { kept, rejected } = splitLockedOps({ days, items }, ops);
    expect(kept).toEqual([{ op: "update", itemId: "open", note: "雨天改去室内" }]);
    expect(rejected).toHaveLength(4);
  });
});
