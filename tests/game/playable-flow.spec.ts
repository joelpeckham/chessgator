import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  openSettings,
  startStubGame,
} from "../shared/playwright-helpers";

test.describe("playable slice (stub Maia)", () => {
  test("complete flow: auto-start, move, opponent reply, resign, restart", async ({
    page,
  }) => {
    await startStubGame(page);

    await expect(page.getByTestId("chessboard")).toBeVisible();
    await expect(page.getByTestId("move-timeline")).toBeVisible();

    await openSettings(page);
    await page.getByTestId("maia-elo-select").click();
    await page.getByRole("option", { name: "1600" }).click();

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("move-list")).toContainText("e4");

    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    const nodeCount = await page
      .locator('[data-testid="move-list"] [data-timeline-node="true"]')
      .count();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    await openSettings(page);
    await page.getByTestId("resign-button").click();
    await page.getByTestId("confirm-resign").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "gameOver",
    );
    await expect(page.getByTestId("live-region")).toContainText(/resign/i);

    await openSettings(page);
    await page.getByTestId("restart-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("move-list")).toContainText("No moves yet");
  });

  test("new game as Black orients the board and waits for Maia's opening", async ({
    page,
  }) => {
    await startStubGame(page);
    await expect(page.getByTestId("chessboard")).toHaveAttribute(
      "data-orientation",
      "white",
    );

    await openSettings(page);
    await page.getByTestId("play-as-select").click();
    await page.getByRole("option", { name: "Black" }).click();
    await page.getByTestId("restart-button").click();

    await expect(page.getByTestId("chessboard")).toHaveAttribute(
      "data-orientation",
      "black",
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("move-list")).not.toContainText(
      "No moves yet",
    );

    await chooseLegalMove(page, "e5");
    await expect(page.getByTestId("move-list")).toContainText("e5");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
  });
});
