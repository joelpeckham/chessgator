import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  startCoachGame,
} from "../shared/playwright-helpers";

test.describe("coaching slice (deterministic engine stubs)", () => {
  test("hints, full feedback, explore line, undo my move", async ({ page }) => {
    await startCoachGame(page);

    await page.getByTestId("toggle-teaching-card").click();
    await expect(page.getByTestId("coach-panel")).toBeVisible();

    // Progressive hint ladder before moving.
    await page.getByTestId("hint-button").click();
    await expect(page.getByTestId("hint-ladder")).toHaveAttribute(
      "data-hint-level",
      "0",
    );
    await expect(page.getByTestId("hint-question")).toBeVisible();

    await page.getByTestId("hint-button").click();
    await expect(page.getByTestId("hint-ladder")).toHaveAttribute(
      "data-hint-level",
      "1",
    );
    await expect(page.getByTestId("hint-squares")).toBeVisible();

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("move-list")).toContainText("e4");

    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-classification",
      "best",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "feedback",
    );
    await expect(page.getByTestId("classification-badge")).toContainText("Best");
    await expect(page.getByTestId("teaching-explanation")).toBeVisible();
    await expect(page.getByTestId("concept-badge")).toHaveCount(0);
    await expect(page.getByTestId("show-line-button")).toHaveCount(0);

    // Opponent replies, then undo White's move and retry.
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await page.getByTestId("takeback-retry-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
    );
    await expect(page.getByTestId("explore-line-button")).toHaveCount(0);
    await expect(page.getByTestId("move-list")).toContainText("No moves yet");
    await expect(page.getByTestId("live-region")).toContainText(/undo|try/i);

    // Tutor can be reopened from timeline controls after feedback clears.
    if ((await page.getByTestId("teaching-card").count()) === 0) {
      await page.getByTestId("toggle-teaching-card").click();
    } else {
      // Already open (pinned) — dismiss and reopen to assert the empty state.
      await page.getByTestId("toggle-teaching-card").click();
      await page.getByTestId("toggle-teaching-card").click();
    }
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "empty",
    );
  });
});
