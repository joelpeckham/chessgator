import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  expandCoach,
  expectCoachCollapsed,
  startCoachGame,
} from "../shared/playwright-helpers";

test.describe("coaching slice (deterministic engine stubs)", () => {
  test("hints, quiet best feedback, explore line, undo my move", async ({
    page,
  }) => {
    await startCoachGame(page);

    await expect(page.getByTestId("coach-strip")).toBeVisible();
    await expectCoachCollapsed(page);

    // Progressive hint ladder opens the expanded panel.
    await page.getByTestId("coach-strip").getByTestId("hint-button").click();
    await expect(page.getByTestId("coach-expanded-panel")).toBeVisible();
    await expect(page.getByTestId("hint-ladder")).toHaveAttribute(
      "data-hint-level",
      "0",
    );
    await expect(page.getByTestId("hint-question")).toBeVisible();

    await page
      .getByTestId("coach-expanded-panel")
      .getByTestId("hint-button")
      .click();
    await expect(page.getByTestId("hint-ladder")).toHaveAttribute(
      "data-hint-level",
      "1",
    );
    await expect(page.getByTestId("hint-squares")).toBeVisible();

    // Collapse without dismissing — Escape collapses the panel.
    await page.keyboard.press("Escape");
    await expectCoachCollapsed(page);

    const boardBefore = await page.getByTestId("board-frame").boundingBox();

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("move-list")).toContainText("e4");

    // Best moves stay collapsed on the rail.
    await expect(page.getByTestId("coach-strip")).toHaveAttribute(
      "data-mode",
      "feedback",
      { timeout: 10_000 },
    );
    await expectCoachCollapsed(page);
    await expect(page.getByTestId("classification-badge-strip")).toContainText(
      "Best",
    );

    const boardAfterBest = await page.getByTestId("board-frame").boundingBox();
    expect(boardBefore).toBeTruthy();
    expect(boardAfterBest).toBeTruthy();
    expect(
      Math.abs((boardAfterBest!.width ?? 0) - (boardBefore!.width ?? 0)),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((boardAfterBest!.x ?? 0) - (boardBefore!.x ?? 0)),
    ).toBeLessThanOrEqual(1);

    await expandCoach(page);
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-classification",
      "best",
    );
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "feedback",
    );
    await expect(page.getByTestId("classification-badge")).toContainText(
      "Best",
    );
    await expect(page.getByTestId("teaching-explanation")).toBeVisible();
    await expect(page.getByTestId("concept-badge")).toHaveCount(0);
    await expect(page.getByTestId("show-line-button")).toHaveCount(0);

    // Expanding must not shift the board.
    const boardAfterExpand = await page
      .getByTestId("board-frame")
      .boundingBox();
    expect(
      Math.abs((boardAfterExpand!.width ?? 0) - (boardAfterBest!.width ?? 0)),
    ).toBeLessThanOrEqual(1);

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

    // After clear, expand shows empty coach state (collapse ≠ dismiss).
    await expandCoach(page);
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "empty",
    );
  });

  test("mistake auto-expands once; collapse is not dismiss", async ({
    page,
  }) => {
    await startCoachGame(page);
    await chooseLegalMove(page, "d4");

    await expect(page.getByTestId("coach-expanded-panel")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "feedback",
    );
    await expect(page.getByTestId("explore-line-button")).toBeVisible();

    // Collapse via Escape — insight remains available on the strip.
    await page.keyboard.press("Escape");
    await expectCoachCollapsed(page);
    await expect(page.getByTestId("coach-strip")).toHaveAttribute(
      "data-mode",
      "feedback",
    );

    await expandCoach(page);
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "feedback",
    );

    // Dismiss clears insight from the rail.
    await page.getByTestId("dismiss-teaching-card").click();
    await expect(page.getByTestId("coach-strip")).toHaveAttribute(
      "data-mode",
      "idle",
    );
  });
});
