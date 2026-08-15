import { expect, type Page } from "@playwright/test";

/** Open settings sheet so keyboard move select is available. */
export async function openSettings(page: Page): Promise<void> {
  const sheet = page.getByTestId("settings-sheet");
  if (await sheet.isVisible().catch(() => false)) {
    const closing = await sheet.evaluate((el) =>
      el.hasAttribute("data-ending-style"),
    );
    if (!closing) return;
    await expect(sheet).toBeHidden();
  }
  await page.getByTestId("settings-button").click();
  await expect(sheet).toBeVisible();
  await expect(sheet).not.toHaveAttribute("data-starting-style");
}

/** Choose a legal move via the accessible move select in settings. */
export async function chooseLegalMove(page: Page, san: string): Promise<void> {
  await openSettings(page);
  await page.getByTestId("accessible-move-select").click();
  await page.getByRole("option", { name: new RegExp(`^${san}\\b`) }).click();
  // Close settings so board/coach UI stays unobscured for assertions.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("settings-sheet")).toBeHidden();
}

/** Expand the coach balloon if it is collapsed. */
export async function expandCoach(page: Page): Promise<void> {
  await expect(page.getByTestId("coach-mascot")).toBeVisible();
  if ((await page.getByTestId("coach-balloon").count()) > 0) return;
  await page.getByTestId("coach-gator").click();
  await expect(page.getByTestId("coach-balloon")).toBeVisible();
}

/** Assert the coach balloon is collapsed (mascot still present). */
export async function expectCoachCollapsed(page: Page): Promise<void> {
  await expect(page.getByTestId("coach-mascot")).toBeVisible();
  await expect(page.getByTestId("coach-balloon")).toHaveCount(0);
}

/** Wait for an auto-started stubbed playable game (`?e2eStub=1`). */
export async function startStubGame(page: Page): Promise<void> {
  await page.goto("/?e2eStub=1");
  await expect(page.getByTestId("game-shell")).toBeVisible();
  await expect(page.getByTestId("game-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
    { timeout: 15_000 },
  );
  await expect(page.getByTestId("status-badge")).toHaveAttribute(
    "data-mode",
    "playerTurn",
    { timeout: 15_000 },
  );
}

/** Wait for an auto-started stubbed coached game (`?e2eStub=coach`). */
export async function startCoachGame(page: Page): Promise<void> {
  await page.goto("/?e2eStub=coach");
  await expect(page.getByTestId("game-shell")).toBeVisible();
  await expect(page.getByTestId("game-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
    { timeout: 15_000 },
  );
  await expect(page.getByTestId("status-badge")).toHaveAttribute(
    "data-mode",
    "playerTurn",
    { timeout: 15_000 },
  );
}
