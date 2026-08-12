import { expect, test, type Page } from "@playwright/test";

async function chooseLegalMove(page: Page, san: string) {
  await page.getByTestId("accessible-move-select").click();
  await page.getByRole("option", { name: new RegExp(`^${san}\\b`) }).click();
}

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
    await expect(page.getByTestId("opponent-source-badge")).toBeVisible({
      timeout: 5_000,
    });

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

    await expect(page.getByTestId("move-list")).toHaveText(/.+/);
    await expect
      .poll(
        async () => {
          const text = await page.getByTestId("move-list").innerText();
          return text.trim().split("\n").filter(Boolean).length;
        },
        { timeout: 180_000 },
      )
      .toBeGreaterThanOrEqual(2);

    // Coaching should leave analyzing and either show a card or stay ready.
    await expect
      .poll(
        async () =>
          page.getByTestId("teaching-card").getAttribute("data-state"),
        { timeout: 180_000 },
      )
      .toMatch(/empty|compact|expanded/);

    const mode = await page
      .getByTestId("status-badge")
      .getAttribute("data-mode");
    expect(mode).not.toBe("error");
    expect(mode).not.toBe("analyzing");
  });
});
