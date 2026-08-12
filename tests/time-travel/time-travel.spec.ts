import { expect, test } from "@playwright/test";
import {
  chooseLegalMove,
  startCoachGame,
} from "../shared/playwright-helpers";

test.describe("time travel + variation explorer", () => {
  test("branch preservation, variation stepping, origin restore, try instead", async ({
    page,
  }) => {
    await startCoachGame(page);

    // Play a non-best first move so the coach line (e4…) is an alternate.
    await chooseLegalMove(page, "d4");
    await expect(page.getByTestId("move-list")).toContainText("d4");
    await expect(page.getByTestId("teaching-card")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await expect(page.getByTestId("explore-line-button")).toBeVisible();
    await page.getByTestId("explore-line-button").click();
    await expect(page.getByTestId("variation-explorer")).toBeVisible();
    await expect(page.getByTestId("variation-explorer")).toHaveAttribute(
      "data-step",
      "0",
    );

    await page.getByTestId("variation-forward").click();
    await expect(page.getByTestId("variation-explorer")).toHaveAttribute(
      "data-step",
      "1",
    );
    await expect(page.locator('[data-ghost-square="true"]').first()).toBeVisible();

    await page.getByTestId("variation-forward").click();
    await expect(page.getByTestId("variation-explorer")).toHaveAttribute(
      "data-step",
      "2",
    );

    await page.getByTestId("variation-exit").click();
    await expect(page.getByTestId("variation-explorer")).toHaveCount(0);
    await expect(page.getByTestId("move-list")).toContainText("d4");

    // Re-enter and commit the first ply of the coach line.
    await page.getByTestId("explore-line-button").click();
    await expect(page.getByTestId("variation-explorer")).toBeVisible();
    await page.getByTestId("variation-try-instead").click();
    await expect(page.getByTestId("variation-explorer")).toHaveCount(0);
    await expect(page.getByTestId("move-list")).toContainText("e4");

    // d4 branch remains reachable from the timeline.
    const d4Branch = page.getByRole("button", { name: /Branch d4/i });
    if (await d4Branch.count()) {
      await d4Branch.click();
      await expect(page.getByTestId("live-region")).toContainText(/d4/i);
    } else {
      // Jump via start then the alternate chip under Start / first ply.
      await page.getByRole("option", { name: /Start/i }).click();
      await page.getByRole("button", { name: /d4/ }).first().click();
    }
  });

  test("timeline jump keeps earlier lines", async ({ page }) => {
    await startCoachGame(page);
    await chooseLegalMove(page, "e4");
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await page.getByRole("option", { name: /Start/i }).click();
    await expect(page.getByTestId("live-region")).toContainText(/start|Jumped/i);
    await expect(page.getByTestId("move-list")).toContainText("e4");

    await page.getByRole("option", { name: /e4/ }).first().click();
    await expect(page.getByTestId("live-region")).toContainText(/e4/i);
  });

  test("undo my move clears coaching so Explore cannot target old node", async ({
    page,
  }) => {
    await startCoachGame(page);
    await chooseLegalMove(page, "d4");
    await expect(page.getByTestId("teaching-card")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("status-badge")).toHaveAttribute(
      "data-mode",
      "playerTurn",
      { timeout: 10_000 },
    );

    await expect(page.getByTestId("explore-line-button")).toBeVisible();

    await page.getByTestId("takeback-retry-button").click();
    await expect(page.getByTestId("live-region")).toContainText(/undo|try/i);
    await expect(page.getByTestId("teaching-card")).toHaveAttribute(
      "data-state",
      "empty",
    );
    await expect(page.getByTestId("explore-line-button")).toHaveCount(0);
    await expect(page.getByTestId("variation-explorer")).toHaveCount(0);
    await expect(page.getByTestId("timeline-takeback")).toHaveCount(0);
    await expect(page.getByTestId("status-badge")).not.toHaveAttribute(
      "data-mode",
      "analyzing",
    );
  });
});
