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

    // Wait for debounced persist (250ms) to write a valid snapshot.
    await expect
      .poll(async () => {
        const raw = await page.evaluate(
          (key) => localStorage.getItem(key),
          STORAGE_KEY,
        );
        if (!raw) return null;
        try {
          return JSON.parse(raw) as {
            version?: number;
            maiaElo?: number;
            tree?: { children?: Array<{ uci?: string }> };
            currentPath?: unknown;
          };
        } catch {
          return null;
        }
      })
      .toMatchObject({
        version: 2,
        maiaElo: 1600,
        tree: { children: [{ uci: "e2e4" }] },
      });
    const raw = await page.evaluate(
      (key) => localStorage.getItem(key),
      STORAGE_KEY,
    );
    const parsed = JSON.parse(raw!) as { currentPath?: unknown };
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

    await page.goto("/game?e2eStub=1");
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

  test("reloads a Black game with side, orientation, and turn", async ({
    page,
  }) => {
    await startStubGame(page);

    await openSettings(page);
    await page
      .getByTestId("play-as-select")
      .getByRole("radio", { name: "Black" })
      .click();
    await page.getByTestId("restart-button").click();

    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("chessboard")).toHaveAttribute(
      "data-orientation",
      "black",
    );

    await expect
      .poll(async () => {
        const raw = await page.evaluate(
          (key) => localStorage.getItem(key),
          STORAGE_KEY,
        );
        if (!raw) return null;
        try {
          return JSON.parse(raw) as {
            version?: number;
            humanColor?: string;
            tree?: { children?: Array<{ uci?: string }> };
          };
        } catch {
          return null;
        }
      })
      .toMatchObject({
        version: 2,
        humanColor: "b",
      });

    await page.reload();
    await expect(page.getByTestId("game-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("chessboard")).toHaveAttribute(
      "data-orientation",
      "black",
    );
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 15_000 },
    );
  });
});
