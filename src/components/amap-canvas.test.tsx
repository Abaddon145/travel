import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AmapCanvas, type MapPoint } from "@/components/amap-canvas";

vi.mock("@amap/amap-jsapi-loader", () => ({
  default: {
    load: () => Promise.reject(new Error("INVALID_USER_DOMAIN")),
  },
}));

const point: MapPoint = {
  id: "a",
  lng: 120.1,
  lat: 30.2,
  label: "白堤",
  color: "#8c4a32",
  badge: "1",
  selected: false,
};

describe("高德底图", () => {
  it("脚本被拒绝时写出中文说明，而不是只留空白框", async () => {
    render(<AmapCanvas apiKey="js-key" points={[point]} lines={[]} onSelect={vi.fn()} />);

    expect(
      await screen.findByText(
        "底图没有加载。地点和路线仍可使用；若它们已经显示，多半是高德没有接受当前页面来源。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("amap-canvas")).toHaveAttribute("data-map-error", "1");
  });
});
