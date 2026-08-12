import { expect, test } from "@playwright/test";
import { chooseLegalMove } from "../shared/playwright-helpers";

/**
 * One Chromium smoke against the built static export with real Maia + Stockfish.
 * Stub suites remain for deterministic product flows.
 */
test.describe("composed real-engine shell", () => {
  test("start, one legal move, opponent reply, coaching state", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("game-shell")).toBeVisible();
    await expect(page.getByTestId("chessboard")).toBeVisible();

    await page.getByTestId("start-button").click();

    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-opponent-phase",
      "ready",
      { timeout: 180_000 },
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
    );

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("move-list")).toContainText("e4");

    // Either analyzing (coach) or opponent thinking / next player turn after reply.
    await expect
      .poll(
        async () =>
          page.getByTestId("status-badge").getAttribute("data-mode"),
        { timeout: 180_000 },
      )
      .toMatch(/analyzing|opponentThinking|playerTurn|reviewing/);

    // Root "Start" plus White's e4 is already two rows — wait for Black's reply.
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

    // Wait until post-move coaching finishes and play has advanced past analyzing.
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

    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      /empty|feedback/,
    );
  });
});
