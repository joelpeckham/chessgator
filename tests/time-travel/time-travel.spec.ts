import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  expandCoach,
  expectCoachCollapsed,
  startCoachGame,
} from "../shared/playwright-helpers";

test.describe("time travel + branching timeline", () => {
  test("branch preservation, coach try-from-here, timeline review", async ({
    page,
  }) => {
    await startCoachGame(page);

    // Play a non-best first move so the coach line (e4…) is an alternate.
    await chooseLegalMove(page, "d4");
    await expect(page.getByTestId("move-list")).toContainText("d4");

    await expect(page.getByTestId("coach-mascot")).toHaveAttribute(
      "data-mode",
      "feedback",
      { timeout: 10_000 },
    );
    await expandCoach(page);
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "feedback",
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await expect(page.getByTestId("explore-line-button")).toBeVisible();
    // Coach alternate should appear on the branching timeline.
    await expect(
      page.locator('[data-testid="move-list"] [data-kind="tutor"]').first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-testid="move-list"] [data-lane="1"]').first(),
    ).toBeVisible();

    const boardBefore = await page.getByTestId("board-frame").boundingBox();

    await page.getByTestId("explore-line-button").click();
    await expect(page.getByTestId("move-list")).toContainText("e4");
    await expect(page.getByTestId("variation-explorer")).toHaveCount(0);

    const boardAfterTry = await page.getByTestId("board-frame").boundingBox();
    expect(boardBefore).toBeTruthy();
    expect(boardAfterTry).toBeTruthy();
    expect(
      Math.abs((boardAfterTry!.width ?? 0) - (boardBefore!.width ?? 0)),
    ).toBeLessThanOrEqual(1);

    // d4 branch remains reachable from the timeline.
    const d4Node = page.getByRole("option", { name: /d4/ });
    await expect(d4Node).toBeVisible();
    await d4Node.click();
    await expect(page.getByTestId("timeline-status")).toContainText(
      /Reviewing|d4/i,
    );
    await expect(page.getByTestId("board-preview-veil")).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(page.getByTestId("board-preview-veil")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page.mouse.move(0, 0);
    const timeline = page.getByTestId("move-list");
    await timeline.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("timeline-status")).toContainText(
      /start|Reviewing/i,
    );
  });

  test("timeline jump keeps earlier lines", async ({ page }) => {
    await startCoachGame(page);
    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    const timeline = page.getByTestId("move-list");
    await timeline.focus();
    await page.keyboard.press("Home");
    await expect(page.getByTestId("timeline-status")).toContainText(
      /Reviewing|start/i,
    );
    await expect(page.getByTestId("board-preview-veil")).toHaveAttribute(
      "data-active",
      "true",
    );
    await expect(page.getByTestId("board-preview-veil")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "reviewing",
    );
    await expect(page.getByTestId("move-list")).toContainText("e4");

    await page.getByTestId("timeline-live").click();
    await expect(page.getByTestId("timeline-status")).toContainText(/Live/i);
    await expect(page.getByTestId("board-preview-veil")).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  test("undo my move clears coaching so Try from here cannot target old node", async ({
    page,
  }) => {
    await startCoachGame(page);
    await chooseLegalMove(page, "d4");
    await expect(page.getByTestId("coach-mascot")).toHaveAttribute(
      "data-mode",
      "feedback",
      { timeout: 10_000 },
    );
    await expandCoach(page);
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await expect(page.getByTestId("explore-line-button")).toBeVisible();

    await page.getByTestId("undo-human-move-button").click();
    await expect(page.getByTestId("live-region")).toContainText(/undo|try/i);
    await expect(page.getByTestId("explore-line-button")).toHaveCount(0);
    await expect(page.getByTestId("variation-explorer")).toHaveCount(0);
    await expect(page.getByTestId("timeline-takeback")).toHaveCount(0);
    await expect(page.getByTestId("status-badge")).not.toHaveAttribute(
      "data-mode",
      "analyzing",
    );

    await expandCoach(page);
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "empty",
    );
    await page.keyboard.press("Escape");
    await expectCoachCollapsed(page);
  });
});
