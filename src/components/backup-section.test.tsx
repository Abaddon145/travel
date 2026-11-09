import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BackupSection } from "@/components/backup-section";
import { resetDatabase } from "@/db/database";
import { AppProviders } from "@/providers/app-providers";

function renderSection() {
  render(
    <AppProviders>
      <MotionConfig reducedMotion="always">
        <BackupSection />
      </MotionConfig>
    </AppProviders>,
  );
}

describe("备份界面", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("拒绝不是备份的文件，并预览旧版本", async () => {
    const user = userEvent.setup();
    renderSection();
    expect(await screen.findByRole("button", { name: "导出备份" })).toBeEnabled();

    const invalid = new File([JSON.stringify({ format: "nope" })], "nope.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText("选择备份文件"), invalid);
    expect(await screen.findByText(/这份文件不是旅序备份/)).toBeInTheDocument();
    expect(screen.getByText(/现有行程还在/)).toBeInTheDocument();

    const legacy = new File(
      [
        JSON.stringify({
          schemaVersion: 1,
          trips: [
            {
              id: "old",
              name: "旧行程",
              destination: "大阪",
              startDate: "2026-12-01",
              endDate: "2026-12-02",
              summary: "",
              createdAt: 1,
              updatedAt: 2,
            },
          ],
          itinerary: [],
        }),
      ],
      "legacy.json",
      { type: "application/json" },
    );
    await user.upload(screen.getByLabelText("选择备份文件"), legacy);
    expect(await screen.findByRole("heading", { name: "导入预览" })).toBeInTheDocument();
    expect(screen.getByText(/版本 1/)).toBeInTheDocument();
    expect(screen.getByText(/旧的扁平行程会拆成按天的日程/)).toBeInTheDocument();
  });
});
