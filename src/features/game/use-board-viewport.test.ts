import { describe, expect, it } from "vitest";
import { computeViewportLayout } from "@/features/game/use-board-viewport";

describe("computeViewportLayout", () => {
  it("centers the gator+board group without reserving a coach column", () => {
    const layout = computeViewportLayout(1280, 900);
    expect(layout.mascotBelow).toBe(false);
    expect(layout.boardSize).toBeGreaterThanOrEqual(480);
    // Gator hugs the board's left edge.
    expect(layout.boardLeft - layout.mascotLeft).toBe(104);
    // Group is centered: leftover on each side matches.
    const groupLeft = layout.mascotLeft - 24;
    const groupRight = layout.boardLeft + layout.boardSize;
    expect(Math.abs(groupLeft - (1280 - groupRight))).toBeLessThanOrEqual(1);
  });

  it("keeps the group centered as the viewport widens", () => {
    const compact = computeViewportLayout(1280, 900);
    const wide = computeViewportLayout(2000, 900);
    expect(wide.boardSize).toBe(compact.boardSize);
    expect(wide.boardLeft).toBeGreaterThan(compact.boardLeft);
    expect(wide.boardLeft - compact.boardLeft).toBe(
      Math.floor((2000 - 1280) / 2),
    );
    expect(wide.mascotLeft - compact.mascotLeft).toBe(
      Math.floor((2000 - 1280) / 2),
    );
  });

  it("keeps the board clear of the left mascot strip when centering would overlap", () => {
    const layout = computeViewportLayout(584, 800);
    expect(layout.mascotBelow).toBe(false);
    expect(layout.boardLeft).toBeGreaterThanOrEqual(128);
    expect(layout.boardLeft + layout.boardSize).toBeLessThanOrEqual(584);
    expect(layout.mascotLeft).toBeGreaterThanOrEqual(24);
    expect(layout.mascotLeft).toBeLessThanOrEqual(layout.boardLeft - 104);
  });

  it("shrinks the board beside the mascot once width is the constraint", () => {
    const wide = computeViewportLayout(700, 800);
    const squeezed = computeViewportLayout(600, 800);
    expect(wide.mascotBelow).toBe(false);
    expect(squeezed.mascotBelow).toBe(false);
    expect(squeezed.boardSize).toBeLessThan(wide.boardSize);
  });

  it("shrinks the board when the timeline is expanded", () => {
    const collapsed = computeViewportLayout(1280, 900, false);
    const expanded = computeViewportLayout(1280, 900, true);
    expect(expanded.boardSize).toBeLessThan(collapsed.boardSize);
  });

  it("snaps the board above the mascot when that leftover is larger", () => {
    const beside = computeViewportLayout(700, 800);
    const stacked = computeViewportLayout(480, 800);
    expect(beside.mascotBelow).toBe(false);
    expect(stacked.mascotBelow).toBe(true);
    // Gator stays close to the screen's left edge under the board.
    expect(stacked.mascotLeft).toBe(24);
  });
});
