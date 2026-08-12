import { expect, test } from "@playwright/test";

const STORAGE_KEY = "chessgator:game:v1";

test.describe("local resume + corruption", () => {
  test("reloads resume tree, elo, and reviewing mode", async ({ page }) => {
    await page.goto("/?e2eStub=1");
    await page.getByTestId("start-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 15_000 },
    );

    await page.getByTestId("maia-elo-select").click();
    await page.getByRole("option", { name: "1600" }).click();

    await page.getByTestId("accessible-move-select").click();
    await page.getByRole("option", { name: /^e4\b/ }).click();
    await expect(page.getByTestId("move-list")).toContainText("e4");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    // Wait for debounced persist.
    await page.waitForTimeout(500);
    const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.preferences.maiaElo).toBe(1600);
    expect(parsed.tree.currentNodeId).toBeTruthy();

    await page.reload();
    await expect(page.getByTestId("game-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("game-shell")).toHaveAttribute(
      "data-resumed",
      "true",
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "reviewing",
    );
    await expect(page.getByTestId("move-list")).toContainText("e4");
    await expect(page.getByTestId("start-button")).toContainText("Continue");

    await page.getByTestId("start-button").click();
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 15_000 },
    );
  });

  test("corrupt localStorage fails closed to a fresh shell", async ({
    page,
  }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, "{not-json");
    }, STORAGE_KEY);

    await page.goto("/?e2eStub=1");
    await expect(page.getByTestId("game-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("game-shell")).toHaveAttribute(
      "data-resumed",
      "false",
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "loading",
    );
    await expect(page.getByTestId("move-list")).toContainText("No moves yet");
  });
});
