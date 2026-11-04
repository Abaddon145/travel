import { beforeEach, describe, expect, it } from "vitest";
import { resolveDark, usePreferences } from "@/stores/preferences";

describe("preferences", () => {
  beforeEach(() => {
    usePreferences.setState({ theme: "system" });
    localStorage.clear();
  });

  it("resolveDark 遵循显式选择与系统偏好", () => {
    expect(resolveDark("dark", false)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
  });

  it("setTheme 更新外观模式", () => {
    usePreferences.getState().setTheme("dark");
    expect(usePreferences.getState().theme).toBe("dark");
  });
});
