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

    await expect(page.getByTestId("coach-mascot")).toBeVisible();
    await expectCoachCollapsed(page);
    await expect(
      page.getByTestId("coach-mascot").getByTestId("hint-button"),
    ).toHaveCount(0);

    // Progressive hint ladder opens the balloon.
    await page.getByTestId("coach-gator").click();
    await expect(page.getByTestId("coach-balloon")).toBeVisible();
    await expect(page.getByTestId("hint-ladder")).toHaveAttribute(
      "data-hint-level",
      "0",
    );
    await expect(page.getByTestId("hint-question")).toBeVisible();

    await page.getByTestId("coach-balloon").getByTestId("hint-button").click();
    await expect(page.getByTestId("hint-ladder")).toHaveAttribute(
      "data-hint-level",
      "1",
    );
    await expect(page.getByTestId("hint-squares")).toBeVisible();

    // Collapse without dismissing — Escape collapses the balloon.
    await page.keyboard.press("Escape");
    await expectCoachCollapsed(page);

    const boardBefore = await page.getByTestId("board-frame").boundingBox();

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("move-list")).toContainText("e4");

    // Best moves stay collapsed; the face reacts.
    await expect(page.getByTestId("coach-mascot")).toHaveAttribute(
      "data-mode",
      "feedback",
      { timeout: 10_000 },
    );
    await expectCoachCollapsed(page);
    await expect(page.getByTestId("coach-mascot")).toHaveAttribute(
      "data-expression",
      "really-happy",
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
    await expect(page.getByTestId("teaching-explanation")).toContainText(
      /because/i,
    );
    await expect(page.getByTestId("teaching-explanation")).toContainText(
      /pawn/i,
    );
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

    await page.getByTestId("undo-human-move-button").click();
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

  test("mistake nudges without opening; collapse is not dismiss", async ({
    page,
  }) => {
    await startCoachGame(page);
    await chooseLegalMove(page, "d4");

    await expect(page.getByTestId("coach-mascot")).toHaveAttribute(
      "data-mode",
      "feedback",
      { timeout: 10_000 },
    );
    await expectCoachCollapsed(page);
    await expect(page.getByTestId("coach-mascot")).toHaveAttribute(
      "data-expression",
      "surprised",
    );
    await expect(page.getByTestId("coach-teaser")).toBeVisible();

    await expandCoach(page);
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "feedback",
    );
    await expect(page.getByTestId("teaching-explanation")).toContainText(
      /because/i,
    );
    await expect(page.getByTestId("explore-line-button")).toBeVisible();

    // Collapse via Escape — insight remains available on the mascot.
    await page.keyboard.press("Escape");
    await expectCoachCollapsed(page);
    await expect(page.getByTestId("coach-mascot")).toHaveAttribute(
      "data-mode",
      "feedback",
    );
    await expect(page.getByTestId("coach-teaser")).toBeVisible();

    await expandCoach(page);
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "feedback",
    );

    await page.keyboard.press("Escape");
    await page.getByTestId("dismiss-teaching-card").click();
    await expect(page.getByTestId("coach-mascot")).toHaveAttribute(
      "data-mode",
      "idle",
    );
  });
});
