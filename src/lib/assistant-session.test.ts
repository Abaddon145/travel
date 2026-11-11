import { describe, expect, it } from "vitest";
import { readAssistantSession, writeAssistantSession } from "@/lib/assistant-session";

describe("助手会话", () => {
  it("离开页面后还能读回对话，并丢掉坏数据", () => {
    writeAssistantSession("trip-1", {
      history: [
        { role: "user", text: "慢一点" },
        { role: "assistant", text: "可以看看这些调整。" },
      ],
      instruction: "再松一点",
      dayId: "day-1",
    });
    expect(readAssistantSession("trip-1")).toEqual({
      history: [
        { role: "user", text: "慢一点" },
        { role: "assistant", text: "可以看看这些调整。" },
      ],
      instruction: "再松一点",
      dayId: "day-1",
    });
    sessionStorage.setItem("lvxu-assistant:trip-2", "{");
    expect(readAssistantSession("trip-2").history).toEqual([]);
  });
});
