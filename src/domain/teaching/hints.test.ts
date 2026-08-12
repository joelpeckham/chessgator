import { describe, expect, it } from "vitest";
import type { AnalysisEvidence } from "@/domain/analysis/types";
import { buildHintStep, nextHintLevel } from "@/domain/teaching/hints";

const fen = "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2";

const analysis: AnalysisEvidence = {
  requestId: "h",
  gameNodeId: "g",
  fen,
  sideToMove: "b",
  score: { cp: -40 },
  bestMoveUci: "g7g6",
  lines: [{ multipv: 1, score: { cp: -40 }, pvUci: ["g7g6", "h5e5"] }],
};

describe("hint escalation", () => {
  it("escalates question → squares → candidate → line", () => {
    const l0 = buildHintStep({
      fen,
      sideToMove: "b",
      positionAnalysis: analysis,
      level: 0,
    });
    expect(l0.question.length).toBeGreaterThan(0);
    expect(l0.highlightSquares).toEqual([]);
    expect(l0.candidateMoveUci).toBeNull();
    expect(l0.lineUci).toEqual([]);

    const l1 = buildHintStep({
      fen,
      sideToMove: "b",
      positionAnalysis: analysis,
      level: 1,
    });
    expect(l1.highlightSquares.length).toBeGreaterThan(0);

    const l2 = buildHintStep({
      fen,
      sideToMove: "b",
      positionAnalysis: analysis,
      level: 2,
    });
    expect(l2.candidateMoveUci).toBe("g7g6");
    expect(l2.candidateMoveSan).toBe("g6");

    const l3 = buildHintStep({
      fen,
      sideToMove: "b",
      positionAnalysis: analysis,
      level: 3,
    });
    expect(l3.lineUci[0]).toBe("g7g6");
  });

  it("caps hint level at 3", () => {
    expect(nextHintLevel(0)).toBe(1);
    expect(nextHintLevel(3)).toBe(3);
  });
});
