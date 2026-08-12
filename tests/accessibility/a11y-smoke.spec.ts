import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  startStubGame,
} from "../shared/playwright-helpers";

test.describe("accessibility + responsive smoke", () => {
  test("keyboard timeline, live region, reduced motion, tablet layout", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 900, height: 1200 });

    await startStubGame(page);
    await expect(page.getByTestId("live-region")).toHaveAttribute(
      "aria-live",
      "polite",
    );

    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("move-list")).toContainText("e4");
    await expect(page.getByTestId("live-region")).toBeVisible();

    const timeline = page.getByTestId("move-list");
    await timeline.focus();
    await page.keyboard.press("Home");
    await expect(page.getByTestId("live-region")).toContainText(/start|Jumped/i);
    await page.keyboard.press("End");
    await expect(page.getByTestId("live-region")).toContainText(/e4|Jumped/i);

    // Board squares expose non-color semantics via aria-label (last move / flags).
    await expect(
      page.locator('[data-square][aria-label*="last move"]').first(),
    ).toBeVisible();

    // Tablet-ish layout: board + aside both present without horizontal clip.
    const shellBox = await page.getByTestId("game-shell").boundingBox();
    const boardBox = await page.getByTestId("chessboard").boundingBox();
    expect(shellBox).toBeTruthy();
    expect(boardBox).toBeTruthy();
    expect(boardBox!.width).toBeGreaterThan(200);
    expect(boardBox!.width).toBeLessThanOrEqual((shellBox!.width ?? 900) + 1);

    await page.screenshot({
      path: "test-results/time-travel-polish.png",
      fullPage: true,
    });
  });
});
