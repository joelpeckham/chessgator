import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  openSettings,
  startStubGame,
} from "../shared/playwright-helpers";

const STORAGE_KEY = "chessgator:game:v2";

test.describe("local resume + corruption", () => {
  test("reloads resume tree, elo, and auto-continues play", async ({
    page,
  }) => {
    await startStubGame(page);

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

    // Wait for debounced persist.
    await page.waitForTimeout(500);
    const raw = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(2);
    expect(parsed.maiaElo).toBe(1600);
    expect(parsed.tree.children?.[0]?.uci).toBe("e2e4");
    expect(Array.isArray(parsed.currentPath)).toBe(true);

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
    // Auto-resume continues play without a Continue button.
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("move-list")).toContainText("e4");
    await expect(page.getByTestId("start-button")).toHaveCount(0);

    await openSettings(page);
    await expect(page.getByTestId("maia-elo-select")).toContainText("1600");
  });

  test("corrupt localStorage fails closed to a fresh auto-started shell", async ({
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
      "playerTurn",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("move-list")).toContainText("No moves yet");
  });
});
