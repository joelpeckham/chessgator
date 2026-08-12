import { describe, expect, it } from "vitest";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { buildMoveAnalysisEvidence } from "@/domain/analysis/move-analysis";
import { tryApplyMove } from "@/domain/game/rules";

function ev(
  fen: string,
  score: AnalysisEvidence["score"],
  bestMoveUci: string,
  pv: string[] = [bestMoveUci],
): AnalysisEvidence {
  return {
    requestId: "x",
    gameNodeId: "y",
    fen,
    sideToMove: fen.includes(" b ") ? "b" : "w",
    score,
    bestMoveUci,
    lines: [{ multipv: 1, score, pvUci: pv }],
  };
}

describe("move analysis evidence", () => {
  it("builds classification + short PV for a best move", () => {
    const fen =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const applied = tryApplyMove(fen, "e2e4")!;
    const evidence = buildMoveAnalysisEvidence({
      requestId: "r",
      gameNodeId: "n1",
      playedMove: applied.move,
      fenBefore: fen,
      fenAfter: applied.fenAfter,
      before: ev(fen, { cp: 25 }, "e2e4", ["e2e4", "e7e5"]),
      after: ev(applied.fenAfter, { cp: 30 }, "e7e5"),
    });
    expect(evidence.classification).toBe("best");
    expect(evidence.shortPvUci[0]).toBe("e2e4");
    expect(evidence.tacticalFacts.developedPiece).toBe(false);
  });

  it("keeps blunder refutation separate from the best-move improvement line", () => {
    const fenBefore =
      "rnbqkbnr/pppp1p1p/6p1/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 0 3";
    const applied = tryApplyMove(fenBefore, "a2a3")!;
    const evidence = buildMoveAnalysisEvidence({
      requestId: "r",
      gameNodeId: "n2",
      playedMove: applied.move,
      fenBefore,
      fenAfter: applied.fenAfter,
      before: ev(fenBefore, { cp: -40 }, "h5e5", ["h5e5", "d7d6"]),
      after: ev(applied.fenAfter, { cp: -900 }, "g6h5", ["g6h5", "a3a4"]),
    });
    expect(evidence.classification).toBe("blunder");
    expect(evidence.shortPvUci[0]).toBe("h5e5");
    expect(evidence.shortPvUci).not.toContain("a2a3");
    expect(evidence.refutationUci[0]).toBe("g6h5");
    expect(evidence.refutationUci).not.toContain("a2a3");
  });
});
