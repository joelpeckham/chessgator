import { describe, expect, it } from "vitest";
import { computeViewportLayout } from "@/features/game/use-board-viewport";

describe("computeViewportLayout", () => {
  it("centers the board on a wide screen without overlapping the peek", () => {
    const layout = computeViewportLayout(1280, 800);
    expect(layout.mascotBelow).toBe(false);
    expect(layout.boardLeft).toBe(Math.floor((1280 - layout.boardSize) / 2));
    expect(layout.boardLeft).toBeGreaterThan(128);
  });

  it("clamps the board to the peek when true center would overlap the mascot", () => {
    const layout = computeViewportLayout(584, 800);
    expect(layout.mascotBelow).toBe(false);
    expect(layout.boardLeft).toBe(128);
  });

  it("shrinks the board beside the mascot once width is the constraint", () => {
    const wide = computeViewportLayout(900, 800);
    const squeezed = computeViewportLayout(600, 800);
    expect(wide.mascotBelow).toBe(false);
    expect(squeezed.mascotBelow).toBe(false);
    expect(squeezed.boardSize).toBeLessThan(wide.boardSize);
  });

  it("snaps the board above the mascot when that leftover is larger", () => {
    const beside = computeViewportLayout(700, 800);
    const stacked = computeViewportLayout(480, 800);
    expect(beside.mascotBelow).toBe(false);
    expect(stacked.mascotBelow).toBe(true);
  });
});
