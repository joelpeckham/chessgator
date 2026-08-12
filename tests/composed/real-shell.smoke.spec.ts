import { expect, test } from "@playwright/test";
import { chooseLegalMove, openSettings } from "../shared/playwright-helpers";

/**
 * One Chromium smoke against the built static export with real Maia + Stockfish.
 * Stub suites remain for deterministic product flows.
 */
test.describe("composed real-engine shell", () => {
  test("auto-start, one legal move, opponent reply, coaching state", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("game-shell")).toBeVisible();
    await expect(page.getByTestId("chessboard")).toBeVisible();
    await expect(page.getByTestId("move-timeline")).toBeVisible();

    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 180_000 },
    );

    // Settings exposes engine status; wait until Maia is ready before relying on replies.
    await openSettings(page);
    await expect
      .poll(
        async () =>
          page.getByTestId("status-badge").getAttribute("data-opponent-phase"),
        { timeout: 180_000 },
      )
      .toMatch(/ready|thinking|starting/);

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("move-list")).toContainText("e4");

    await expect
      .poll(
        async () =>
          page.getByTestId("status-badge").getAttribute("data-mode"),
        { timeout: 180_000 },
      )
      .toMatch(/analyzing|opponentThinking|playerTurn|reviewing/);

    await expect
      .poll(
        async () => {
          const nodes = page.locator(
            '[data-testid="move-list"] [data-timeline-node="true"]',
          );
          return nodes.count();
        },
        { timeout: 180_000 },
      )
      .toBeGreaterThanOrEqual(3);

    await expect
      .poll(
        async () =>
          page.getByTestId("status-badge").getAttribute("data-mode"),
        { timeout: 180_000 },
      )
      .toMatch(/opponentThinking|playerTurn|reviewing|gameOver/);

    await expect(page.getByTestId("status-badge")).not.toHaveAttribute(
      "data-mode",
      "error",
    );

    if ((await page.getByTestId("teaching-card").count()) === 0) {
      await page.getByTestId("toggle-teaching-card").click();
    }
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      /empty|feedback|analyzing/,
    );
  });
});
