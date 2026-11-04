// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { ReviseRequest } from "../../shared/revise-schema";
import { reviseItinerary } from "./revise";

const request: ReviseRequest = {
  instruction: "删掉住宿并改备注",
  scope: { dayId: "d1", itemIds: [] },
  history: [],
  trip: {
    title: "杭州",
    destination: "杭州",
    days: [
      {
        id: "d1",
        title: "第一天",
        date: "2026-11-21",
        locked: false,
        lockedFrom: "",
        lockedTo: "",
        items: [
          {
            id: "locked",
            name: "白川庵",
            area: "",
            note: "",
            timeLabel: "15:00",
            locked: true,
            order: 0,
            kind: "lodging",
          },
          {
            id: "open",
            name: "三年坂",
            area: "",
            note: "旧",
            timeLabel: "17:30",
            locked: false,
            order: 1,
            kind: "place",
          },
        ],
      },
    ],
  },
};

function completion(content: unknown) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    }),
    { status: 200 },
  );
}

describe("助手调整", () => {
  it("锁定项目从补丁里剔除，其余可以预览", async () => {
    const result = await reviseItinerary({
      request,
      apiKey: "sk-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      fetchImpl: vi.fn(async () =>
        completion({
          message: "只改未锁定的。",
          ops: [
            { op: "remove", itemId: "locked" },
            { op: "update", itemId: "open", note: "雨天改去室内" },
          ],
        }),
      ) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ops).toEqual([{ op: "update", itemId: "open", note: "雨天改去室内" }]);
    expect(result.rejected).toEqual([{ op: "remove", itemId: "locked" }]);
  });

  it("补丁全部碰到锁定时不返回可应用操作", async () => {
    const result = await reviseItinerary({
      request,
      apiKey: "sk-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      fetchImpl: vi.fn(async () =>
        completion({ message: "想删住宿。", ops: [{ op: "remove", itemId: "locked" }] }),
      ) as unknown as typeof fetch,
    });
    expect(result).toMatchObject({ ok: false, error: "locked_violation" });
  });
});
