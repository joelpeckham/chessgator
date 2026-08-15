import { describe, expect, it } from "vitest";
import { computeViewportLayout } from "@/features/game/use-board-viewport";

describe("computeViewportLayout", () => {
  it("docks a coach column when the leftover board is still large", () => {
    const layout = computeViewportLayout(1280, 900);
    expect(layout.coachDocked).toBe(true);
    expect(layout.mascotBelow).toBe(false);
    expect(layout.boardSize).toBeGreaterThanOrEqual(480);
  });

  it("centers the coach lane with the board as the viewport widens", () => {
    const compact = computeViewportLayout(1280, 900);
    const wide = computeViewportLayout(2000, 900);
    expect(compact.coachDocked).toBe(true);
    expect(wide.coachDocked).toBe(true);
    expect(wide.boardSize).toBe(compact.boardSize);
    expect(wide.coachLaneLeft).toBeGreaterThan(compact.coachLaneLeft);
    expect(wide.coachLaneLeft - compact.coachLaneLeft).toBe(
      Math.floor((2000 - 1280) / 2),
    );
  });

  it("clamps the board to the peek when true center would overlap the mascot", () => {
    const layout = computeViewportLayout(584, 800);
    expect(layout.coachDocked).toBe(false);
    expect(layout.coachLaneLeft).toBe(0);
    expect(layout.mascotBelow).toBe(false);
    expect(layout.boardLeft).toBe(128);
  });

  it("shrinks the board beside the mascot once width is the constraint", () => {
    const wide = computeViewportLayout(700, 800);
    const squeezed = computeViewportLayout(600, 800);
    expect(wide.coachDocked).toBe(false);
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
    expect(stacked.coachDocked).toBe(false);
  });
});
