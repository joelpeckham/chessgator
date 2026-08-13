import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  expandCoach,
  startStubGame,
} from "../shared/playwright-helpers";

test.describe("accessibility + responsive smoke", () => {
  test("keyboard timeline, live region, reduced motion, board-first layout", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 900, height: 1200 });

    await startStubGame(page);
    await expect(page.getByTestId("live-region")).toHaveAttribute(
      "aria-live",
      "polite",
    );
    await expect(page.getByTestId("coach-mascot")).toBeVisible();

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("move-list")).toContainText("e4");
    await expect(page.getByTestId("live-region")).toBeVisible();

    const timeline = page.getByTestId("move-list");
    await timeline.focus();
    await page.keyboard.press("Home");
    await expect(page.getByTestId("timeline-status")).toContainText(
      /Reviewing|start/i,
    );
    await expect(page.getByTestId("timeline-live")).toBeVisible();
    await expect(page.getByTestId("board-preview-veil")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await page.keyboard.press("End");
    await expect(page.getByTestId("timeline-status")).toContainText(/Live/i);
    const selected = page
      .locator('[data-testid="move-timeline"] [aria-selected="true"]')
      .first();
    await expect(selected).toBeVisible();
    const selectedId = await selected.evaluate((el) => el.id);
    expect(selectedId).toMatch(/^timeline-node-/);
    await expect(timeline).toHaveAttribute("aria-activedescendant", selectedId);

    // Single listbox tab stop — option nodes are not separately tabbable.
    const optionTabIndexes = await page
      .locator('[data-testid="move-list"] [role="option"]')
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).tabIndex));
    expect(optionTabIndexes.every((t) => t === -1)).toBe(true);

    // Board squares expose non-color semantics via aria-label (last move / flags).
    await expect(
      page.locator('[data-square][aria-label*="last move"]').first(),
    ).toBeVisible();

    // Board-first layout: board and timeline fit within the shell width.
    const shellBox = await page.getByTestId("game-shell").boundingBox();
    const boardBox = await page.getByTestId("chessboard").boundingBox();
    const timelineBox = await page.getByTestId("move-timeline").boundingBox();
    expect(shellBox).toBeTruthy();
    expect(boardBox).toBeTruthy();
    expect(timelineBox).toBeTruthy();
    expect(boardBox!.width).toBeGreaterThan(200);
    expect(boardBox!.width).toBeLessThanOrEqual((shellBox!.width ?? 900) + 1);
    expect(timelineBox!.width).toBeLessThanOrEqual(
      (shellBox!.width ?? 900) + 1,
    );

    await page.screenshot({
      path: "test-results/board-first-ui.png",
      fullPage: true,
    });
  });

  test("mobile viewport: coach mascot, touch targets, board stability", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startStubGame(page);

    await expect(page.getByTestId("coach-mascot")).toBeVisible();
    const boardBefore = await page.getByTestId("board-frame").boundingBox();

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    // Best move stays collapsed; expand via mascot.
    await expandCoach(page);
    const boardAfter = await page.getByTestId("board-frame").boundingBox();
    expect(boardBefore).toBeTruthy();
    expect(boardAfter).toBeTruthy();
    expect(
      Math.abs((boardAfter!.width ?? 0) - (boardBefore!.width ?? 0)),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((boardAfter!.y ?? 0) - (boardBefore!.y ?? 0)),
    ).toBeLessThanOrEqual(1);

    // Timeline nodes meet touch target size on narrow viewports.
    const node = page
      .locator('[data-testid="move-list"] [data-timeline-node="true"]')
      .first();
    const nodeBox = await node.boundingBox();
    expect(nodeBox).toBeTruthy();
    expect(nodeBox!.width).toBeGreaterThanOrEqual(44);
    expect(nodeBox!.height).toBeGreaterThanOrEqual(44);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("coach-balloon")).toHaveCount(0);

    // No horizontal overflow of board/timeline.
    const shellBox = await page.getByTestId("game-shell").boundingBox();
    const boardBox = await page.getByTestId("chessboard").boundingBox();
    const timelineBox = await page.getByTestId("move-timeline").boundingBox();
    expect(boardBox!.width).toBeLessThanOrEqual((shellBox!.width ?? 390) + 1);
    expect(timelineBox!.width).toBeLessThanOrEqual(
      (shellBox!.width ?? 390) + 1,
    );

    await page.screenshot({
      path: "test-results/board-first-ui-mobile.png",
      fullPage: true,
    });
  });
});
