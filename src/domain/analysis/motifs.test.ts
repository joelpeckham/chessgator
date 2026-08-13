import { describe, expect, it } from "vitest";
import { namedUnitAt } from "@/domain/analysis/board-units";
import {
  detectBackRankVulnerability,
  detectDiscoveredAttacks,
  detectForks,
  detectPassedPawns,
  detectPins,
  detectSkewers,
} from "@/domain/analysis/motifs";
import {
  collectStructureDelta,
  detectGamePhase,
} from "@/domain/analysis/structure";
import { createChess, tryApplyMove } from "@/domain/game";

describe("motif detectors", () => {
  it("detects a relative pin of a knight to a queen", () => {
    const before = "k3q3/8/4n3/8/8/8/8/R6K w - - 0 1";
    const applied = tryApplyMove(before, "a1e1")!;
    const after = createChess(applied.fenAfter);
    const pins = detectPins(after, "b", { relative: true });
    expect(
      pins.some(
        (pin) =>
          !pin.absolute && pin.pinned.type === "n" && pin.target.type === "q",
      ),
    ).toBe(true);
  });

  it("detects a skewer of king and rook", () => {
    const chess = createChess("4r3/8/8/8/8/8/4k3/4R2K w - - 0 1");
    const skewers = detectSkewers(chess, "b");
    expect(
      skewers.some((s) => s.front.type === "k" && s.back.type === "r"),
    ).toBe(true);
  });

  it("detects a discovered check when a knight vacates a rook file", () => {
    const before = "3k4/8/8/8/8/8/3N4/3RK3 w - - 0 1";
    const applied = tryApplyMove(before, "d2e4")!;
    const beforeBoard = createChess(before);
    const afterBoard = createChess(applied.fenAfter);
    const discovered = detectDiscoveredAttacks(
      beforeBoard,
      afterBoard,
      applied.move,
    );
    expect(discovered.some((d) => d.isCheck)).toBe(true);
  });

  it("detects a created passed pawn", () => {
    const before = "8/8/4p3/3P4/8/8/8/4K2k w - - 0 1";
    const applied = tryApplyMove(before, "d5e6")!;
    const after = createChess(applied.fenAfter);
    const passed = detectPassedPawns(after, "w");
    expect(passed.some((p) => p.square === "e6")).toBe(true);
  });

  it("flags a boxed king as a back-rank concern", () => {
    const chess = createChess("6k1/5ppp/8/8/8/8/8/R6K w - - 0 1");
    expect(detectBackRankVulnerability(chess, "b")).toBe(true);
  });

  it("still detects a knight fork of king and queen", () => {
    const before = "4k3/8/8/8/3Q4/n7/8/4K3 b - - 0 1";
    const applied = tryApplyMove(before, "a3c2")!;
    const after = createChess(applied.fenAfter);
    const forker = namedUnitAt(after, "c2")!;
    const forks = detectForks(after, forker);
    const types = forks[0]?.targets.map((t) => t.type).toSorted() ?? [];
    expect(types).toContain("k");
    expect(types).toContain("q");
  });
});

describe("game phase", () => {
  it("labels the start position as opening", () => {
    const chess = createChess();
    expect(detectGamePhase(chess)).toBe("opening");
  });

  it("labels a king-and-pawns position as endgame", () => {
    const chess = createChess("8/8/8/8/8/8/4P3/4K2k w - - 0 1");
    expect(detectGamePhase(chess)).toBe("endgame");
  });
});

describe("pawn structure", () => {
  it("credits a rook for gaining a semi-open file", () => {
    const before = createChess("4k3/5p2/8/8/8/8/8/R3K3 w - - 0 1");
    const after = createChess("4k3/5p2/8/8/8/8/8/4KR2 w - - 1 1");
    const delta = collectStructureDelta(before, after, "w");
    expect(delta.gainedSemiOpenFile).toBe(true);
    expect(delta.gainedOpenFile).toBe(false);
  });
});
