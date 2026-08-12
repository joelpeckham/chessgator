import { expect, type Page } from "@playwright/test";

/** Choose a legal move via the accessible move select. */
export async function chooseLegalMove(page: Page, san: string): Promise<void> {
  await page.getByTestId("accessible-move-select").click();
  await page.getByRole("option", { name: new RegExp(`^${san}\\b`) }).click();
}

/** Start a stubbed playable game (`?e2eStub=1`) and wait for player turn. */
export async function startStubGame(page: Page): Promise<void> {
  await page.goto("/?e2eStub=1");
  await expect(page.getByTestId("game-shell")).toBeVisible();
  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("status-badge")).toHaveAttribute(
    "data-mode",
    "playerTurn",
    { timeout: 15_000 },
  );
}

/** Start a stubbed coached game (`?e2eStub=coach`) and wait for player turn. */
export async function startCoachGame(page: Page): Promise<void> {
  await page.goto("/?e2eStub=coach");
  await expect(page.getByTestId("game-shell")).toBeVisible();
  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("status-badge")).toHaveAttribute(
    "data-mode",
    "playerTurn",
    { timeout: 15_000 },
  );
}
