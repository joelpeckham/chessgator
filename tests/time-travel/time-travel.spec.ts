import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  expandCoach,
  expectCoachCollapsed,
  selectedTimelineNode,
  startCoachGame,
  startStubGame,
} from "../shared/playwright-helpers";

test.describe("time travel + branching timeline", () => {
  test("realizing the gator line branches the tree and keeps the old move", async ({
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
    await expect(
      page
        .locator('[data-testid="move-timeline"] [data-kind="suggested"]')
        .first(),
    ).toBeVisible({ timeout: 10_000 });

    const boardBefore = await page.getByTestId("board-frame").boundingBox();

    await page.getByTestId("explore-line-button").click();
    await expect(page.getByTestId("move-list")).toContainText("e4");
    await expect(page.getByTestId("move-list")).toContainText("d4");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("practice-controls")).toHaveCount(0);
    await expect(page.getByTestId("variation-explorer")).toHaveCount(0);

    const boardAfterTry = await page.getByTestId("board-frame").boundingBox();
    expect(boardBefore).toBeTruthy();
    expect(boardAfterTry).toBeTruthy();
    expect(
      Math.abs((boardAfterTry!.width ?? 0) - (boardBefore!.width ?? 0)),
    ).toBeLessThanOrEqual(1);

    const d4Node = page
      .locator(
        '[data-testid="move-timeline"] button[data-kind="committed"][aria-label*="d4"]',
      )
      .first();
    await expect(d4Node).toBeVisible();
    await d4Node.click();
    await expect(selectedTimelineNode(page)).toHaveAttribute(
      "aria-label",
      /d4/i,
    );

    const timeline = page.getByTestId("move-list");
    await timeline.focus();
    await page.keyboard.press("ArrowDown");
    await expect(
      page
        .locator('[data-testid="move-timeline"] [aria-selected="true"]')
        .first(),
    ).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(selectedTimelineNode(page)).toHaveAttribute(
      "aria-label",
      /start/i,
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
    await expect(selectedTimelineNode(page)).toHaveAttribute(
      "aria-label",
      /start/i,
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
    );
    await expect(page.getByTestId("move-list")).toContainText("e4");

    await page.keyboard.press("End");
    await expect(selectedTimelineNode(page)).toHaveAttribute(
      "aria-label",
      /current position/i,
    );
    await expect(selectedTimelineNode(page)).not.toHaveAttribute(
      "aria-label",
      /start/i,
    );
  });

  test("jumping to start hides Try from here for the old node", async ({
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
    const timeline = page.getByTestId("move-list");
    await timeline.focus();
    await page.keyboard.press("Home");
    await expect(selectedTimelineNode(page)).toHaveAttribute(
      "aria-label",
      /start/i,
    );
    await expect(page.getByTestId("explore-line-button")).toHaveCount(0);
    await expect(page.getByTestId("variation-explorer")).toHaveCount(0);
    await expect(page.getByTestId("practice-controls")).toHaveCount(0);
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

  test("prune tool cuts descendants after confirmation", async ({ page }) => {
    await startStubGame(page);
    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("move-list")).toContainText("e4");

    const timeline = page.getByTestId("move-list");
    await timeline.focus();
    await page.keyboard.press("Home");
    await expect(selectedTimelineNode(page)).toHaveAttribute(
      "aria-label",
      /start/i,
    );

    await page.getByTestId("timeline-prune").click();
    await expect(page.getByTestId("move-timeline")).toHaveAttribute(
      "data-prune-mode",
      "true",
    );

    const startNode = page
      .locator(
        '[data-testid="move-timeline"] [data-timeline-node][aria-label*="start" i]',
      )
      .first();
    await startNode.hover();
    await expect(
      page
        .locator(
          '[data-testid="move-timeline"] [data-timeline-node][data-prune-target="true"]',
        )
        .first(),
    ).toBeVisible();

    await startNode.click();
    await expect(page.getByTestId("confirm-prune")).toBeVisible();
    await page.getByTestId("confirm-prune").click();

    await expect(page.getByTestId("move-list")).not.toContainText("e4");
    await expect(selectedTimelineNode(page)).toHaveAttribute(
      "aria-label",
      /start/i,
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
    );
    await expect(page.getByTestId("move-timeline")).toHaveAttribute(
      "data-prune-mode",
      "false",
    );
  });
});
