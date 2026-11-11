import type { Page } from "@playwright/test";

export async function settleEnter(page: Page) {
  const entered = page.locator(".lvxu-page-in");
  if ((await entered.count()) === 0) return;
  await entered.evaluateAll(async (elements) => {
    await Promise.all(
      elements.flatMap((element) =>
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
  });
}
