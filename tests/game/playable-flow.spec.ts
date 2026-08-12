import { expect, test } from "@playwright/test";
import { chooseLegalMove, startStubGame } from "../shared/playwright-helpers";

test.describe("playable slice (stub Maia)", () => {
  test("complete flow: start, move, opponent reply, resign, restart", async ({
    page,
  }) => {
    await startStubGame(page);

    await expect(page.getByTestId("chessboard")).toBeVisible();

    await page.getByTestId("maia-elo-select").click();
    await page.getByRole("option", { name: "1600" }).click();

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("move-list")).toContainText("e4");

    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("move-list")).toHaveText(/.+/);
    const moveText = await page.getByTestId("move-list").innerText();
    expect(moveText.trim().split("\n").length).toBeGreaterThanOrEqual(2);

    await page.getByTestId("resign-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "gameOver",
    );
    await expect(page.getByTestId("status-panel")).toContainText(/resign/i);

    await page.getByTestId("restart-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("move-list")).toContainText("No moves yet");
  });
});
