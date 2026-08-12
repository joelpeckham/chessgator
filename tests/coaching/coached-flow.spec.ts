import { expect, test, type Page } from "@playwright/test";

async function chooseLegalMove(page: Page, san: string) {
  await page.getByTestId("accessible-move-select").click();
  await page.getByRole("option", { name: new RegExp(`^${san}\\b`) }).click();
}

test.describe("coaching slice (deterministic engine stubs)", () => {
  test("hints, compact feedback, show-line, takeback-and-retry", async ({
    page,
  }) => {
    await page.goto("/?e2eStub=coach");

    await expect(page.getByTestId("game-shell")).toBeVisible();
    await expect(page.getByTestId("coach-panel")).toBeVisible();

    await page.getByTestId("start-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 15_000 },
    );

    // Progressive hint ladder before moving.
    await page.getByTestId("hint-button").click();
    await expect(page.getByTestId("hint-ladder")).toHaveAttribute(
      "data-hint-level",
      "0",
    );
    await expect(page.getByTestId("hint-question")).toBeVisible();

    await page.getByTestId("hint-button").click();
    await expect(page.getByTestId("hint-ladder")).toHaveAttribute(
      "data-hint-level",
      "1",
    );
    await expect(page.getByTestId("hint-squares")).toBeVisible();

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("move-list")).toContainText("e4");

    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-classification",
      "best",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "compact",
    );
    await expect(page.getByTestId("classification-badge")).toContainText("Best");

    await page.getByTestId("show-line-button").click();
    await expect(page.getByTestId("show-line-button")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByTestId("toggle-teaching-card").click();
    await expect(page.getByTestId("shown-line")).toBeVisible();

    // Opponent replies, then take back White's move and retry.
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await page.getByTestId("takeback-retry-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
    );
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "empty",
    );
    await expect(page.getByTestId("move-list")).toContainText("No moves yet");
  });
});
