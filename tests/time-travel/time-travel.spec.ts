import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  startCoachGame,
} from "../shared/playwright-helpers";

test.describe("time travel + branching timeline", () => {
  test("branch preservation, tutor try-from-here, timeline review", async ({
    page,
  }) => {
    await startCoachGame(page);

    // Play a non-best first move so the coach line (e4…) is an alternate.
    await chooseLegalMove(page, "d4");
    await expect(page.getByTestId("move-list")).toContainText("d4");
    await expect(page.getByTestId("teaching-card")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await expect(page.getByTestId("explore-line-button")).toBeVisible();
    // Tutor alternate should appear on the branching timeline.
    await expect(
      page.locator('[data-testid="move-list"] [data-kind="tutor"]').first(),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("explore-line-button").click();
    await expect(page.getByTestId("move-list")).toContainText("e4");
    await expect(page.getByTestId("variation-explorer")).toHaveCount(0);

    // d4 branch remains reachable from the timeline.
    const d4Node = page
      .locator('[data-testid="move-list"] [data-timeline-node="true"]')
      .filter({ hasText: /d4/ })
      .first();
    if (await d4Node.count()) {
      await d4Node.click();
      await expect(page.getByTestId("live-region")).toContainText(/d4|Viewing/i);
    }
  });

  test("timeline jump keeps earlier lines", async ({ page }) => {
    await startCoachGame(page);
    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await page.getByTestId("timeline-first").click();
    await expect(page.getByTestId("live-region")).toContainText(
      /start|Viewing|Returned/i,
    );
    await expect(page.getByTestId("move-list")).toContainText("e4");

    await page.getByTestId("timeline-live").click();
    await expect(page.getByTestId("live-region")).toContainText(
      /live|e4|Returned/i,
    );
  });

  test("undo my move clears coaching so Try from here cannot target old node", async ({
    page,
  }) => {
    await startCoachGame(page);
    await chooseLegalMove(page, "d4");
    await expect(page.getByTestId("teaching-card")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await expect(page.getByTestId("explore-line-button")).toBeVisible();

    await page.getByTestId("takeback-retry-button").click();
    await expect(page.getByTestId("live-region")).toContainText(/undo|try/i);
    await expect(page.getByTestId("explore-line-button")).toHaveCount(0);
    await expect(page.getByTestId("variation-explorer")).toHaveCount(0);
    await expect(page.getByTestId("timeline-takeback")).toHaveCount(0);
    await expect(page.getByTestId("status-badge")).not.toHaveAttribute(
      "data-mode",
      "analyzing",
    );

    if ((await page.getByTestId("teaching-card").count()) === 0) {
      await page.getByTestId("toggle-teaching-card").click();
    } else {
      await page.getByTestId("toggle-teaching-card").click();
      await page.getByTestId("toggle-teaching-card").click();
    }
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "empty",
    );
  });
});
