import { describe, expect, it } from "vitest";
import { ValidationError } from "@/db/errors";
import { fieldErrors, parseTripInput, tripInputSchema } from "@/db/validation";

const valid = {
  title: "京都",
  destination: "京都",
  startDate: "2026-11-12",
  endDate: "2026-11-16",
  summary: "",
};

describe("校验", () => {
  it("拒绝空标题和颠倒的日期", () => {
    expect(() => parseTripInput({ ...valid, title: "  " })).toThrow(ValidationError);
    const result = tripInputSchema.safeParse({
      ...valid,
      startDate: "2026-11-20",
      endDate: "2026-11-12",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).endDate).toBe("结束日期不能早于开始日期");
    }
  });

  it("接受一份完整行程", () => {
    expect(parseTripInput(valid).title).toBe("京都");
  });
});
