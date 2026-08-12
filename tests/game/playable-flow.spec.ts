import { expect, test, type Page } from "@playwright/test";

async function chooseLegalMove(page: Page, san: string) {
  await page.getByTestId("accessible-move-select").click();
  await page.getByRole("option", { name: new RegExp(`^${san}\\b`) }).click();
}

test.describe("playable slice (stub opponents)", () => {
  test("complete flow: start, move, opponent reply, resign, restart", async ({
    page,
  }) => {
    await page.goto("/?e2eStub=1");

    await expect(page.getByTestId("game-shell")).toBeVisible();
    await expect(page.getByTestId("chessboard")).toBeVisible();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "loading",
    );

    await page.getByTestId("maia-elo-select").click();
    await page.getByRole("option", { name: "1600" }).click();

    await page.getByTestId("start-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-opponent-phase",
      "ready",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
    );
    await expect(page.getByTestId("opponent-source-badge")).toContainText("Maia");

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

  test("shows Stockfish fallback when Maia init fails", async ({ page }) => {
    await page.goto("/?e2eStub=fallback");

    await page.getByTestId("start-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-opponent-source",
      "stockfish",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("status-detail")).toContainText(
      /Maia unavailable/i,
    );
    await expect(page.getByTestId("opponent-source-badge")).toContainText(
      "Stockfish",
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
    );
  });
});
